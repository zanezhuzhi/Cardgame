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
  DamagePool,
} from '../types/index';
import { createEmptyDamagePool } from '../types/index';

// 导入卡牌数据
import * as fs from 'fs';
import * as path from 'path';

// 导入牌库展示管理器
import { DeckRevealHelper } from './DeckRevealHelper';

// 导入式神技能引擎
import { ShikigamiSkillEngine } from '../../../shared/game/effects/ShikigamiSkillEngine';
import { SKILL_DEFS } from '../../../shared/game/effects/ShikigamiSkillDefs';
import type { SkillContext } from '../../../shared/types/shikigami';

// 导入伤害系统（镜姬【妖】效果免疫判定）
import { isDamageImmune, createDamageSource } from '../../../shared/game/DamageSystem';

// ============ TempBuff 简化管理 ============
// 临时buff类型定义（与shared/game/TempBuff.ts同步）
type TempBuffType = 
  | 'DAMAGE_BONUS' 
  | 'SPELL_DAMAGE_BONUS' 
  | 'EXILE_KILL_DAMAGE'
  | 'NEXT_YOKAI_DOUBLE'
  | 'FIRST_KILL_TO_HAND'
  | 'SKIP_CLEANUP'
  | 'SKILL_COST_REDUCTION'
  | 'HP_REDUCTION'
  | 'SKILL_DAMAGE_BONUS';

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
  
  /**
   * 消费式神技能伤害加成（针女效果）
   * 每次使用式神技能时触发，累加所有 SKILL_DAMAGE_BONUS buff 的 value
   * 与其他 buff 不同，此 buff 不消耗（可多次触发直到回合结束）
   */
  static consumeSkillDamageBonus(player: PlayerState): number {
    if (!player.tempBuffs) return 0;
    return (player.tempBuffs as any[])
      .filter(b => b.type === 'SKILL_DAMAGE_BONUS')
      .reduce((sum, b) => sum + (b.value || 2), 0);
  }
  
  static shouldSkipCleanup(player: PlayerState): boolean {
    return TempBuffHelper.hasBuff(player, 'SKIP_CLEANUP');
  }
  
  static clearBuffs(player: PlayerState): void {
    player.tempBuffs = [];
  }

  // ======== 网切 field 级别 buff 管理 ========
  
  /** 应用网切效果到 field（覆盖不叠加） */
  static applyNetCutterToField(field: FieldState): void {
    if (!(field as any).tempBuffs) (field as any).tempBuffs = [];
    // 移除已有网切 buff（覆盖不叠加）
    (field as any).tempBuffs = ((field as any).tempBuffs as any[]).filter(
      (b: any) => b.type !== 'NET_CUTTER_HP_REDUCTION'
    );
    // 添加新的网切 buff
    (field as any).tempBuffs.push({
      type: 'NET_CUTTER_HP_REDUCTION',
      yokaiHpModifier: -1,
      bossHpModifier: -2,
      minHp: 1,
      expiresAt: 'endOfTurn',
      source: '网切'
    });
  }

  /** 检查 field 是否有网切效果 */
  static hasNetCutter(field: FieldState): boolean {
    return ((field as any).tempBuffs || []).some(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
  }

  /** 获取网切后的妖怪有效HP（最低为1） */
  static getNetCutterEffectiveHp(field: FieldState, baseHp: number, cardType: 'yokai' | 'boss'): number {
    if (!TempBuffHelper.hasNetCutter(field)) return baseHp;
    const reduction = cardType === 'boss' ? 2 : 1;
    return Math.max(1, baseHp - reduction);
  }

  /** 清除 field 上的网切效果 */
  static clearFieldNetCutter(field: FieldState): void {
    if (!(field as any).tempBuffs) return;
    (field as any).tempBuffs = ((field as any).tempBuffs as any[]).filter(
      (b: any) => b.type !== 'NET_CUTTER_HP_REDUCTION'
    );
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
  AFK_TIMEOUT_MS: 300000, // 无操作超时（5分钟）
  RECONNECT_GRACE_MS: 180000, // 掉线保护窗口（3分钟）
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
  /** 强制退出回调（AFK/离线超时） */
  private onForceExit?: (playerId: string, reason: 'afk' | 'disconnect_timeout') => void;
  
  /** 回合超时定时器 */
  private turnTimer?: NodeJS.Timeout;
  /** 无操作检查定时器 */
  private afkTimer?: NodeJS.Timeout;
  
  /** 式神选择倒计时 */
  private shikigamiSelectTimer?: NodeJS.Timeout;
  
  /** 式神选择开始时间 */
  private shikigamiSelectStartTime?: number;
  
  /** 式神选择状态 */
  private shikigamiSelections: Map<string, string[]> = new Map();
  
  /** 赤舌选择超时计时器 */
  private akajitaTimer?: NodeJS.Timeout;
  
  /** 是否已清理 */
  private cleaned: boolean = false;

  /** 式神技能引擎 */
  private readonly skillEngine: ShikigamiSkillEngine;

  constructor(roomId: string, players: PlayerInfo[]) {
    this.roomId = roomId;
    this.playerInfoMap = new Map(players.map(p => [p.id, p]));
    
    // 初始化式神技能引擎
    this.skillEngine = new ShikigamiSkillEngine();
    this.skillEngine.registerAll(SKILL_DEFS);
    
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

    // 为未确认的玩家：已勾满 2 个则视同确认；否则随机补全（与 confirmShikigamiSelection 一致）
    for (const player of this.state.players) {
      const selectedList = (player as any).selectedShikigami as ShikigamiCard[] || [];
      
      if (!player.isReady && selectedList.length >= 2) {
        player.shikigami = [...selectedList] as ShikigamiCard[];
        player.shikigamiState = selectedList.map((s) => ({
          cardId: s.id,
          isExhausted: false,
          markers: {},
        }));
        player.isReady = true;
        this.addLog(`⏰ ${player.name} 超时，自动确认所选式神：${selectedList.map((s) => s.name).join('、')}`);
        continue;
      }

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
      pendingDeathChoices: [],  // [已废弃] 击杀时直接退治，不再使用待选列表
      killedBossThisTurn: false,  // 本回合是否击杀了鬼王
      pendingBossDeath: false,  // [已废弃] 击杀时直接退治，不再使用
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

  /**
   * 设置强制退出回调（由 SocketServer 负责实际移出房间）
   */
  setOnForceExit(callback: (playerId: string, reason: 'afk' | 'disconnect_timeout') => void): void {
    this.onForceExit = callback;
  }

  /**
   * AFK / 掉线超时等：从对局座位移除玩家，修正 currentPlayerIndex 与回合计时；
   * 若移除的是当前行动玩家则新开其下一位的回合。须在本轮收集完待踢名单后再调用，避免遍历中改数组。
   */
  removePlayerFromActiveGame(playerId: string, options?: { silent?: boolean }): void {
    const idx = this.state.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    if (this.state.phase !== 'playing') return;

    const removed = this.state.players[idx];
    const name = removed.name;

    this.playerInfoMap.delete(playerId);
    this.shikigamiSelections.delete(playerId);

    const pc = (this.state as any).pendingChoice;
    if (pc?.playerId === playerId) {
      (this.state as any).pendingChoice = undefined;
    }

    const wasCurrent = idx === this.state.currentPlayerIndex;
    this.clearTurnTimer();

    this.state.players.splice(idx, 1);
    if (typeof this.state.playerCount === 'number') {
      this.state.playerCount = this.state.players.length;
    }

    if (this.state.players.length === 0) {
      if (!options?.silent) {
        this.addLog(`🚪 ${name} 已离开，对局结束`);
      }
      this.endGame();
      return;
    }

    if (idx < this.state.currentPlayerIndex) {
      this.state.currentPlayerIndex--;
    } else if (wasCurrent) {
      if (this.state.currentPlayerIndex >= this.state.players.length) {
        this.state.currentPlayerIndex = 0;
        this.state.turnNumber++;
      }
    }

    if (!options?.silent) {
      this.addLog(`🚪 ${name} 已离开对局`);
    }

    if (wasCurrent) {
      const next = this.getCurrentPlayer();
      this.addLog(`📍 第 ${this.state.turnNumber} 回合，轮到 ${next.name}`);
      this.startTurn();
    } else {
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    }
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
    const now = Date.now();
    for (const p of this.state.players) {
      p.lastActionAt = now;
      p.disconnectedAt = undefined;
      p.isOfflineHosted = false;
    }
    this.startAfkMonitor();
    
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

  /** 当前对局中的真人玩家数量（不含 AI 座位） */
  private getHumanPlayerCount(): number {
    return this.state.players.filter(p => !p.isAI).length;
  }

  /**
   * 按真人数计算回合倒计时（毫秒）
   * 1人=无限，其余按规则映射。
   */
  private getTurnTimeoutMsByHumanCount(): number {
    // 测试环境：禁用回合倒计时
    if (process.env.DISABLE_TURN_TIMEOUT === '1') {
      return 0;
    }
    const humanCount = this.getHumanPlayerCount();
    if (humanCount <= 1) return 0;
    if (humanCount === 2) return 30000;
    if (humanCount === 3) return 25000;
    if (humanCount === 4) return 20000;
    return 15000; // 5-6人
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    const timeoutMs = this.getTurnTimeoutMsByHumanCount();
    this.state.turnTimeoutMs = timeoutMs;
    this.state.turnStartAt = timeoutMs > 0 ? Date.now() : undefined;
    if (timeoutMs <= 0) return;

    const playerId = this.getCurrentPlayer().id;
    const snapshotTurn = this.state.turnNumber;
    const snapshotIndex = this.state.currentPlayerIndex;
    this.turnTimer = setTimeout(() => {
      // 防止旧定时器误触发新回合
      if (
        this.state.turnNumber !== snapshotTurn ||
        this.state.currentPlayerIndex !== snapshotIndex ||
        this.getCurrentPlayer().id !== playerId
      ) {
        return;
      }
      this.handleTurnTimeout(playerId);
    }, timeoutMs);
  }

  /** 回合超时：清理待选择并强制结束当前玩家回合 */
  private handleTurnTimeout(playerId: string): void {
    if (this.state.phase !== 'playing' || this.state.turnPhase !== 'action') return;
    const current = this.getCurrentPlayer();
    if (!current || current.id !== playerId) return;

    // 超时视为玩家发生一次系统操作，避免被 AFK 检查立即判退
    this.markPlayerAction(playerId);
    this.resolvePendingChoiceForTimeout(playerId);
    this.addLog(`⏰ ${current.name} 回合超时，自动结束回合`);
    this.handleEndTurn(playerId);
  }

  /** 超时/托管兜底：若存在待选择，自动按最保守分支处理，避免卡死 */
  private resolvePendingChoiceForTimeout(playerId: string): void {
    const pc = (this.state as any).pendingChoice;
    if (!pc || pc.playerId !== playerId) return;
    if (pc.type === 'salvageChoice') {
      this.handleSalvageResponse(playerId, false);
      return;
    }
    if (pc.type === 'yokaiTarget') {
      const opts: string[] = pc.options || [];
      if (opts.length > 0) this.handleYokaiTargetResponse(playerId, opts[0]);
      else (this.state as any).pendingChoice = undefined;
      return;
    }
    if (pc.type === 'yokaiChoice') {
      const opts: string[] = pc.options || [];
      const damageIdx = opts.findIndex((x: string) => String(x).includes('伤害'));
      this.handleYokaiChoiceResponse(playerId, damageIdx >= 0 ? damageIdx : 0);
      return;
    }
    if (pc.type === 'selectCardsMulti') {
      // 超时默认不弃任何牌（空数组）
      this.handleSelectCardsMultiResponse(playerId, []);
      return;
    }
    if (pc.type === 'wheelMonkDiscard') {
      // 超时默认选第一张御魂
      const candidates: string[] = pc.candidates || [];
      if (candidates.length > 0) {
        this.handleWheelMonkDiscardResponse(playerId, candidates[0]);
      } else {
        (this.state as any).pendingChoice = undefined;
      }
      return;
    }
    (this.state as any).pendingChoice = undefined;
  }

  private clearAfkTimer(): void {
    if (this.afkTimer) {
      clearInterval(this.afkTimer);
      this.afkTimer = undefined;
    }
  }

  private startAfkMonitor(): void {
    this.clearAfkTimer();
    this.afkTimer = setInterval(() => this.checkInactivityKick(), 1000);
  }

  private markPlayerAction(playerId: string): void {
    const p = this.getPlayer(playerId);
    if (!p) return;
    p.lastActionAt = Date.now();
  }

  /** AFK 判定：300 秒无有效操作直接退出（回调给 Socket 层实际离房） */
  private checkInactivityKick(): void {
    if (this.state.phase !== 'playing') return;
    const now = Date.now();
    const toKick: string[] = [];
    for (const p of this.state.players) {
      if (p.isAI) continue;
      if (!p.isConnected) continue; // 离线走断线窗口判定
      const last = p.lastActionAt || this.state.lastUpdate || now;
      if (now - last >= GAME_CONSTANTS.AFK_TIMEOUT_MS) {
        toKick.push(p.id);
      }
    }
    for (const id of toKick) {
      const p = this.getPlayer(id);
      if (!p || p.isAI || !p.isConnected) continue;
      this.addLog(`🚪 ${p.name} 长时间无操作（300秒）已退出游戏`);
      this.removePlayerFromActiveGame(id, { silent: true });
      this.onForceExit?.(id, 'afk');
    }
  }

  /** 玩家断线：进入保护期并启用离线托管 */
  public onPlayerDisconnected(playerId: string): void {
    const p = this.getPlayer(playerId);
    if (!p) return;
    p.isConnected = false;
    p.disconnectedAt = Date.now();
    p.isOfflineHosted = true;
    this.addLog(`📴 ${p.name} 已掉线，进入180秒重连保护（离线托管中）`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    setTimeout(() => {
      const cur = this.getPlayer(playerId);
      if (!cur || cur.isConnected) return;
      if ((Date.now() - (cur.disconnectedAt || 0)) < GAME_CONSTANTS.RECONNECT_GRACE_MS) return;
      cur.isOfflineHosted = false;
      this.addLog(`🚪 ${cur.name} 掉线超时（180秒）已退出游戏`);
      this.removePlayerFromActiveGame(playerId, { silent: true });
      this.onForceExit?.(playerId, 'disconnect_timeout');
    }, GAME_CONSTANTS.RECONNECT_GRACE_MS + 500);
  }

  /** 玩家重连恢复控制 */
  public onPlayerReconnected(playerId: string): void {
    const p = this.getPlayer(playerId);
    if (!p) return;
    p.isConnected = true;
    p.disconnectedAt = undefined;
    p.isOfflineHosted = false;
    p.lastActionAt = Date.now();
    this.addLog(`🔌 ${p.name} 已重连，恢复真人控制`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
  }

  /** 调试：强制触发当前回合超时流程 */
  public forceCurrentTurnTimeout(): boolean {
    if (this.state.phase !== 'playing' || this.state.turnPhase !== 'action') return false;
    const current = this.getCurrentPlayer();
    if (!current) return false;
    this.handleTurnTimeout(current.id);
    return true;
  }

  /** 调试：将玩家最后操作时间回拨 N 秒 */
  public debugSetPlayerLastActionAgo(playerId: string, secondsAgo: number): boolean {
    const p = this.getPlayer(playerId);
    if (!p) return false;
    const safeSec = Math.max(0, Math.floor(secondsAgo));
    p.lastActionAt = Date.now() - safeSec * 1000;
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return true;
  }

  /** 调试：立即执行一次 AFK 检查 */
  public debugRunAfkCheck(): void {
    this.checkInactivityKick();
  }

  /** 离线托管状态查询 */
  public isOfflineHostedPlayer(playerId: string): boolean {
    const p = this.getPlayer(playerId);
    return !!p?.isOfflineHosted;
  }

  /** 重连时把旧 socketId 迁移到新 socketId */
  public rebindPlayerId(oldPlayerId: string, newPlayerId: string, newName?: string): boolean {
    if (oldPlayerId === newPlayerId) {
      this.onPlayerReconnected(oldPlayerId);
      return true;
    }
    const idx = this.state.players.findIndex(p => p.id === oldPlayerId);
    if (idx < 0) return false;
    if (this.state.players.some(p => p.id === newPlayerId)) return false;
    const prev = this.state.players[idx];
    this.playerInfoMap.delete(oldPlayerId);
    this.playerInfoMap.set(newPlayerId, {
      id: newPlayerId,
      name: newName || prev.name,
    });
    this.state.players[idx] = {
      ...prev,
      id: newPlayerId,
      name: newName || prev.name,
      isConnected: true,
      disconnectedAt: undefined,
      isOfflineHosted: false,
      lastActionAt: Date.now(),
    };
    if ((this.state as any).pendingChoice?.playerId === oldPlayerId) {
      (this.state as any).pendingChoice.playerId = newPlayerId;
    }
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return true;
  }

  /**
   * 开始回合
   */
  private startTurn(): void {
    const player = this.getCurrentPlayer();
    
    // 强制关闭赤舌选择（如果当前玩家有pending的赤舌选择，自动默认选基础术式）
    this.forceCloseAkajitaSelectForPlayer(player.id);
    
    // 重置回合状态
    player.damage = 0;
    player.cardsPlayed = 0;
    player.tempBuffs = [];
    player.lastActionAt = Date.now();
    this.state.turnHadKill = false;
    
    // 式神引擎：回合开始 → 重置疲劳/使用计数/清理指示物
    this.skillEngine.onTurnStart(player as any);
    
    // 鬼王【自】效果：回合开始时从弃牌堆回收（蜃气楼、荒骷髅、贪嗔痴）
    this.checkBossRecoveryOnTurnStart(player);
    
    // 进入鬼火阶段
    this.enterGhostFirePhase();
  }
  
  /**
   * 回合开始时检查鬼王【自】回收效果
   * 蜃气楼、荒骷髅、贪嗔痴：若在弃牌堆则回到手牌
   */
  private checkBossRecoveryOnTurnStart(player: PlayerState): void {
    const recoverableBosses = ['蜃气楼', '荒骷髅', '贪嗔痴'];
    
    for (const bossName of recoverableBosses) {
      const bossIdx = player.discard.findIndex(c => 
        c.cardType === 'boss' && c.name === bossName
      );
      
      if (bossIdx !== -1) {
        const bossCard = player.discard.splice(bossIdx, 1)[0]!;
        player.hand.push(bossCard);
        this.addLog(`🔄 【自】${player.name} 的 ${bossName} 从弃牌堆回到手牌`);
      }
    }
  }
  
  /**
   * 回合结束时检查麒麟【触】效果
   * 麒麟：若在弃牌堆则归牌库底
   */
  private checkKirinEndOfTurn(player: PlayerState): void {
    const kirinIdx = player.discard.findIndex(c => 
      c.cardType === 'boss' && c.name === '麒麟'
    );
    
    if (kirinIdx !== -1) {
      const kirinCard = player.discard.splice(kirinIdx, 1)[0]!;
      player.deck.unshift(kirinCard); // 放到牌库底（unshift放到数组开头=牌库底）
      this.addLog(`🔄 【触】${player.name} 的麒麟归入牌库底`);
    }
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
    this.startTurnTimer();
    
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
    this.clearTurnTimer();
    this.state.turnStartAt = undefined;
    this.state.turnTimeoutMs = undefined;
    
    // 重置伤害池（镜姬【妖】效果追踪）
    this.state.damagePool = createEmptyDamagePool();
    
    // 重置本回合鬼王击杀标记（ allocate 路径用于 UI 待选）
    (this.state as any).killedBossThisTurn = false;

    const hadKillThisTurn = !!this.state.turnHadKill;
    
    // 检查食梦貘「沉睡」buff - 跳过清理阶段
    if (TempBuffHelper.shouldSkipCleanup(player)) {
      this.addLog(`😴 ${player.name} 跳过清理阶段（沉睡）`);
      // 清空buff（含 field 级别的网切 buff）
      TempBuffHelper.clearBuffs(player);
      TempBuffHelper.clearFieldNetCutter(this.state.field);
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
    
    // 4. 弃置所有手牌（规则弃置，不触发【触】）
    this.discardMany(player, player.hand, 'rule');
    player.hand = [];
    
    // 5. 弃置所有已打出的牌（规则弃置）
    this.discardMany(player, player.played, 'rule');
    player.played = [];
    
    // 5.5. 麒麟【触】效果：回合结束时从弃牌堆归牌库底
    this.checkKirinEndOfTurn(player);
    
    // 6. 重置本回合打牌计数
    player.cardsPlayed = 0;
    
    // 7. 式神引擎：回合结束 → 清理 TURN_END 指示物
    this.skillEngine.onTurnEnd(player as any);
    
    // 8. 清空TempBuff（含玩家级别和 field 级别的网切 buff）
    TempBuffHelper.clearBuffs(player);
    TempBuffHelper.clearFieldNetCutter(this.state.field);
    
    // 8.1 清空镇墓兽禁止退治目标
    player.prohibitedTargets = undefined;
    
    // 9. 抓5张牌
    this.drawCards(player, GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // 10. 补充妖怪
    this.fillYokaiSlots();
    
    // 11. 如果本回合击败了鬼王，翻出下一张鬼王并执行来袭效果
    if ((this.state as any).pendingBossReveal) {
      (this.state as any).pendingBossReveal = false;
      this.revealBoss();
      // 来袭效果会影响已抽好的手牌
    }
    
    // 12. 检查游戏是否结束（最后一个鬼王被击败）
    if ((this.state as any).pendingGameEnd) {
      (this.state as any).pendingGameEnd = false;
      this.endGame();
      return;
    }
    
    // 13. 清空伤害（实际上在步骤3已清空，这里是规则文档的顺序）
    // player.damage = 0; // 已在步骤3执行
    
    // 14. 记录上一回合是否达成击杀（游荡妖怪/鬼王生命扣至0，强于离场规则）
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
      const r = this.handleShikigamiAction(playerId, action);
      if (r.success) this.markPlayerAction(playerId);
      return r;
    }
    
    // GM指令不检查回合
    const gmActions = ['gmAddTestCards', 'gmAddCard', 'gmSetShikigami', 'gmAddDamage', 'gmAddToDiscard'];
    if (gmActions.includes(action.type)) {
      const r = this.handleGmAction(playerId, action);
      if (r.success) this.markPlayerAction(playerId);
      return r;
    }

    // 式神选择同步阶段：禁止对局内行动（避免 currentPlayerIndex===0 误当成「可出牌回合」）
    if (this.state.phase === 'shikigamiSelect') {
      return { success: false, error: '式神选择阶段不可进行此操作' };
    }
    
    // 式神获取相关action不检查回合（需要实时响应）
    const shikigamiAcquireActions = ['getShikigamiCandidates', 'acquireShikigami', 'replaceShikigami'];
    if (shikigamiAcquireActions.includes(action.type)) {
      let r: { success: boolean; error?: string } = { success: false, error: '无效动作' };
      switch (action.type) {
        case 'getShikigamiCandidates':
          r = this.handleGetShikigamiCandidates(playerId, action.spellIds, action.isReplace);
          break;
        case 'acquireShikigami':
          r = this.handleAcquireShikigami(playerId, action.shikigamiId, action.spellIds);
          break;
        case 'replaceShikigami':
          r = this.handleReplaceShikigami(playerId, action.shikigamiId, action.slotIndex || 0, action.spellIds);
          break;
      }
      if (r.success) this.markPlayerAction(playerId);
      return r;
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
    
    let result: { success: boolean; error?: string };
    switch (action.type) {
      // === 大写格式（兼容旧代码）===
      case 'PLAY_CARD':
        result = this.handlePlayCard(playerId, action.cardInstanceId);
        break;
      
      case 'USE_SKILL':
        result = this.handleUseSkill(playerId, action.shikigamiId, action.targetId);
        break;
      
      case 'ATTACK':
        result = this.handleAttack(playerId, action.targetId, action.damage);
        break;
      
      case 'DECIDE_YOKAI_REFRESH':
        result = this.handleYokaiRefresh(action.refresh);
        break;
      
      case 'END_TURN':
        result = this.handleEndTurn(playerId);
        break;
      
      case 'SELECT_SHIKIGAMI':
        result = this.handleShikigamiSelection(playerId, action.selectedIds);
        break;
      
      // === 小写格式（客户端使用）===
      case 'playCard':
        result = this.handlePlayCard(playerId, action.cardInstanceId);
        break;
      
      case 'useShikigamiSkill':
        result = this.handleUseSkill(playerId, action.shikigamiId, action.targetId);
        break;
      
      case 'attackBoss':
        result = this.handleAttackBoss(playerId, action.damage);
        break;
      
      case 'allocateDamage':
        result = this.handleAllocateDamage(playerId, action.slotIndex);
        break;
      
      case 'retireYokai':
        result = this.handleRetireYokai(playerId, action.slotIndex);
        break;
      
      case 'banishYokai':
        result = this.handleBanishYokai(playerId, action.slotIndex);
        break;
      
      case 'retireBoss':
        result = this.handleRetireBoss(playerId);
        break;
      
      case 'banishBoss':
        result = this.handleBanishBoss(playerId);
        break;
      
      
      case 'decideYokaiRefresh':
        result = this.handleYokaiRefresh(action.refresh);
        break;
      
      case 'endTurn':
        result = this.handleEndTurn(playerId);
        break;
      
      case 'confirmShikigamiPhase':
        result = this.handleConfirmShikigamiPhase(playerId);
        break;
      
      case 'gainBasicSpell':
        result = this.handleGainBasicSpell(playerId);
        break;
      
      case 'exchangeMediumSpell':
        result = this.handleExchangeMediumSpell(playerId, action.yokaiId);
        break;
      
      case 'exchangeAdvancedSpell':
        result = this.handleExchangeAdvancedSpell(playerId, action.yokaiId);
        break;
      
      case 'acquireShikigami':
        result = this.handleAcquireShikigami(playerId, action.shikigamiId, action.spellIds);
        break;
      
      case 'replaceShikigami':
        result = this.handleReplaceShikigami(playerId, action.shikigamiId, action.slotIndex || 0, action.spellIds);
        break;
      
      case 'getShikigamiCandidates':
        result = this.handleGetShikigamiCandidates(playerId, action.spellIds, action.isReplace);
        break;
      
      default:
        result = { success: false, error: `未知的操作类型: ${(action as any).type}` };
        break;
    }
    if (result.success) this.markPlayerAction(playerId);
    return result;
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
    
    // 计算网切修正后的鬼王有效HP（网切: 鬼王HP-2，最低1）
    const bossBaseHp = this.state.field.bossCurrentHp;
    const bossEffectiveHp = TempBuffHelper.getNetCutterEffectiveHp(this.state.field, bossBaseHp, 'boss');
    
    // 扣除伤害并对鬼王造成伤害
    player.damage -= damage;
    this.state.field.bossCurrentHp -= damage;
    
    if (bossEffectiveHp !== bossBaseHp) {
      this.addLog(`⚔️ ${player.name} 对鬼王造成 ${damage} 点伤害（网切: HP ${bossBaseHp}→${bossEffectiveHp}）`);
    } else {
      this.addLog(`⚔️ ${player.name} 对鬼王造成 ${damage} 点伤害`);
    }
    
    // 检查鬼王是否被击败 → 退治判定基于有效HP
    if (damage >= bossEffectiveHp) {
      this.markTurnHadKill();
      (this.state as any).killedBossThisTurn = true;
      
      const boss = this.state.field.currentBoss!;
      // 直接退治：鬼王进入弃牌堆
      player.discard.push(boss as any);
      
      // 检查茨木「迁怒」buff
      const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
      if (exileBonus > 0) {
        player.damage += exileBonus;
        this.addLog(`💀 ${player.name} 退治了鬼王 ${boss.name}（+${boss.charm || 0} 声誉，迁怒+${exileBonus}伤害）`);
      } else {
        this.addLog(`💀 ${player.name} 退治了鬼王 ${boss.name}（+${boss.charm || 0} 声誉）`);
      }
      
      // 清除当前鬼王并翻出下一个
      this.state.field.currentBoss = null;
      this.revealBoss();
    }
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理分配伤害到妖怪
   * 精细伤害追踪：镜姬只免疫 spell 伤害，yokai/shikigami/other 伤害正常生效
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
    
    // 确保 damagePool 存在
    if (!this.state.damagePool) {
      this.state.damagePool = createEmptyDamagePool();
    }
    const pool = this.state.damagePool;
    
    // 检查镜姬【妖】效果：免疫阴阳术伤害
    const isJingji = yokai.name === '镜姬';
    const availableNonSpellDamage = pool.yokai + pool.shikigami + pool.other;
    
    if (isJingji) {
      // 镜姬只能受到非 spell 伤害
      if (availableNonSpellDamage <= 0) {
        this.addLog(`🛡️ ${yokai.name} 免疫阴阳术伤害！`);
        return { success: false, error: `${yokai.name}免疫阴阳术伤害` };
      }
    }
    
    // 计算网切修正后的有效HP（网切: 妖怪HP-1，最低1）
    const baseHp = yokai.hp || 0;
    const effectiveHp = TempBuffHelper.getNetCutterEffectiveHp(this.state.field, baseHp, 'yokai');
    
    // 计算实际可分配的伤害
    let damageDealt: number;
    if (isJingji) {
      // 镜姬：只能分配非 spell 伤害
      damageDealt = Math.min(availableNonSpellDamage, effectiveHp);
    } else {
      // 普通妖怪：可分配所有伤害
      damageDealt = Math.min(player.damage, effectiveHp);
    }
    
    // 从 damagePool 中扣除已分配的伤害（优先消耗 yokai → shikigami → other → spell）
    let remainingToDeduct = damageDealt;
    
    // 1. 先扣 yokai
    if (remainingToDeduct > 0 && pool.yokai > 0) {
      const deduct = Math.min(remainingToDeduct, pool.yokai);
      pool.yokai -= deduct;
      remainingToDeduct -= deduct;
    }
    // 2. 再扣 shikigami
    if (remainingToDeduct > 0 && pool.shikigami > 0) {
      const deduct = Math.min(remainingToDeduct, pool.shikigami);
      pool.shikigami -= deduct;
      remainingToDeduct -= deduct;
    }
    // 3. 再扣 other
    if (remainingToDeduct > 0 && pool.other > 0) {
      const deduct = Math.min(remainingToDeduct, pool.other);
      pool.other -= deduct;
      remainingToDeduct -= deduct;
    }
    // 4. 最后扣 spell（镜姬不会走到这里）
    if (remainingToDeduct > 0 && pool.spell > 0 && !isJingji) {
      const deduct = Math.min(remainingToDeduct, pool.spell);
      pool.spell -= deduct;
      remainingToDeduct -= deduct;
    }
    
    player.damage -= damageDealt;
    // 注意：扣减的是有效HP上的伤害，映射回实际HP
    yokai.hp = baseHp - damageDealt;
    
    if (effectiveHp !== baseHp) {
      this.addLog(`⚔️ ${player.name} 对 ${yokai.name} 造成 ${damageDealt} 点伤害（网切: HP ${baseHp}→${effectiveHp}）`);
    } else {
      this.addLog(`⚔️ ${player.name} 对 ${yokai.name} 造成 ${damageDealt} 点伤害`);
    }
    
    // 检查妖怪是否被击杀 → 退治判定基于有效HP
    if (damageDealt >= effectiveHp) {
      this.markTurnHadKill();
      // 直接退治：移入弃牌堆
      this.ensureYokaiDiscardFaceStats(yokai);
      player.discard.push(yokai);
      this.state.field.yokaiSlots[slotIndex] = null;
      
      // 检查茨木「迁怒」buff
      const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
      if (exileBonus > 0) {
        player.damage += exileBonus;
        this.addLog(`💀 ${player.name} 退治了 ${yokai.name}（+${yokai.charm || 0} 声誉，迁怒+${exileBonus}伤害）`);
      } else {
        this.addLog(`💀 ${player.name} 退治了 ${yokai.name}（+${yokai.charm || 0} 声誉）`);
      }
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
    
    // 检查是否被镇墓兽禁止退治
    if (player.prohibitedTargets?.includes(yokai.instanceId)) {
      return { success: false, error: '镇墓兽效果：本回合不能退治该目标' };
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
    
    // 式神引擎：广播妖怪击杀事件
    this.emitSkillEvent(player, { type: 'YOKAI_KILLED', yokai: yokai as any, slotIndex });
    
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
    
    // 检查是否被镇墓兽禁止退治（鬼王使用 boss.id 作为 instanceId）
    if (player.prohibitedTargets?.includes(boss.id)) {
      return { success: false, error: '镇墓兽效果：本回合不能退治该目标' };
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
      // 异步执行来袭效果，不阻塞主流程
      this.executeBossArrivalEffect(boss).catch(err => {
        this.addLog(`   ⚠️ 来袭效果执行失败: ${err}`);
      });
    }
  }
  
  /**
   * 执行鬼王来袭效果
   * 统一调用共享层 BossEffects.ts 的实现
   */
  private async executeBossArrivalEffect(boss: BossCard): Promise<void> {
    const bossName = boss.name;
    this.addLog(`   👹 ${bossName} 来袭！`);
    
    // 使用共享层的 BossEffects
    const { executeBossArrival, clearOrochiEffect, clearEarthquakeCatfishEffect } = await import('../../../shared/game/effects/BossEffects');
    
    const context = {
      gameState: this.state,
      bossCard: boss as CardInstance,
      // 选择卡牌回调（用于需要玩家选择的效果）
      onSelectCards: async (cards: CardInstance[], count: number): Promise<string[]> => {
        // 默认自动选择：按HP从低到高选
        const sorted = [...cards].sort((a, b) => (a.hp || 0) - (b.hp || 0));
        return sorted.slice(0, count).map(c => c.instanceId);
      },
      // 二选一回调
      onChoice: async (options: string[]): Promise<number> => {
        // 默认选第一个选项
        return 0;
      }
    };
    
    try {
      const result = await executeBossArrival(bossName, context);
      
      if (result.message) {
        this.addLog(`   💀 ${result.message}`);
      }
      
      // 特殊效果日志
      this.logBossArrivalDetails(bossName);
      
    } catch (error) {
      this.addLog(`   ⚠️ 来袭效果执行出错: ${error}`);
    }
  }
  
  /**
   * 执行飞缘魔效果（使用当前鬼王的御魂效果）
   * 异步方法，避免在同步 executeYokaiEffect 中使用 await
   */
  private async executeFeiYuanMoEffect(player: PlayerState, boss: BossCard): Promise<void> {
    try {
      const { executeBossSoul } = await import('../../../shared/game/effects/BossEffects');
      const context = {
        gameState: this.state,
        bossCard: boss as CardInstance,
        player,
        onSelectCards: async (cards: CardInstance[], count: number): Promise<string[]> => {
          // 默认自动选择：按HP从低到高选
          const sorted = [...cards].sort((a, b) => (a.hp || 0) - (b.hp || 0));
          return sorted.slice(0, count).map(c => c.instanceId);
        },
        onChoice: async (options: string[]): Promise<number> => {
          return 0;
        }
      };
      
      const result = await executeBossSoul(boss.name, context);
      if (result.success && result.message) {
        this.addLog(`   💫 ${result.message}`);
      }
      
      // 状态同步
      this.notifyStateChange();
    } catch (error) {
      // 降级：如果引擎调用失败，按简化逻辑处理
      this.addLog(`   ⚠️ 鬼王效果执行出错，使用默认效果`);
      player.damage += 3;
      this.notifyStateChange();
    }
  }
  
  /**
   * 记录鬼王来袭的详细日志
   */
  private logBossArrivalDetails(bossName: string): void {
    switch (bossName) {
      case '石距':
        for (const player of this.state.players) {
          const spellCount = player.discard.filter(c => c.cardType === 'spell').length;
          if (spellCount > 0) {
            this.addLog(`      ${player.name} 弃置了 ${spellCount} 张阴阳术`);
          } else {
            this.addLog(`      ${player.name} 无阴阳术，获得1张恶评`);
          }
        }
        break;
        
      case '鬼灵歌伎':
        for (const player of this.state.players) {
          this.addLog(`      ${player.name} 牌库顶HP>6的牌已弃置`);
        }
        break;
        
      case '土蜘蛛':
        for (const player of this.state.players) {
          const spellCount = player.hand.filter(c => c.cardType === 'spell').length;
          const missing = Math.max(0, 3 - spellCount);
          if (missing > 0) {
            this.addLog(`      ${player.name} 缺少 ${missing} 张阴阳术，弃置了 ${missing} 张手牌`);
          }
        }
        break;
        
      case '胧车':
        for (const player of this.state.players) {
          const exiledCount = player.exiled?.length || 0;
          if (exiledCount > 0) {
            this.addLog(`      ${player.name} 超度了御魂`);
          } else {
            this.addLog(`      ${player.name} 无御魂可超度，获得恶评`);
          }
        }
        break;
        
      case '蜃气楼':
        for (const player of this.state.players) {
          const highHpCards = player.discard.filter(c => (c.hp || 0) > 6);
          if (highHpCards.length > 0) {
            this.addLog(`      ${player.name} 弃置了HP>6的手牌`);
          }
        }
        break;
        
      case '荒骷髅':
        for (const player of this.state.players) {
          this.addLog(`      ${player.name} 牌库已全弃，超度HP>7御魂，获得恶评，重洗牌库`);
        }
        break;
        
      case '地震鲶':
        this.addLog(`      每回合清理阶段后，随机1张手牌将被放到阴阳师下`);
        break;
        
      case '八岐大蛇':
        for (const player of this.state.players) {
          this.addLog(`      ${player.name} 弃置了最高HP手牌，式神失去能力`);
        }
        break;
        
      case '贪嗔痴':
        this.addLog(`      手牌HP最高的玩家额外弃置了1张手牌`);
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
   * 御魂打出前置：纯单目标效果在无合法目标时禁止打出
   * 参考《卡牌开发》§ 单目标效果与可用性
   */
  private validateYokaiMustHaveTarget(card: CardInstance): string | null {
    const player = this.getCurrentPlayer();
    
    // 天邪鬼绿：场上需要有HP≤4的游荡妖怪
    if (card.name === '天邪鬼绿' || card.cardId === 'yokai_003') {
      const hasTarget = this.state.field.yokaiSlots.some(
        (y): y is CardInstance => y !== null && (y.hp || 0) <= 4 && (y.hp || 0) > 0
      );
      if (!hasTarget) {
        return '场上没有生命≤4的游荡妖怪，无法使用天邪鬼绿';
      }
    }
    
    // 轮入道：手牌中需要有【其他】HP≤6的御魂
    if (card.name === '轮入道' || card.cardId === 'yokai_019') {
      const hasValidYokai = player.hand.some(c => 
        c.instanceId !== card.instanceId && // 不能是轮入道本身
        c.cardType === 'yokai' && 
        (c.hp || 0) <= 6
      );
      if (!hasValidYokai) {
        return '手牌中没有可弃置的御魂（生命≤6），无法使用轮入道';
      }
    }
    
    // 骰子鬼：手牌中需要有【其他】牌可超度
    if (card.name === '骰子鬼' || card.cardId === 'yokai_015') {
      const hasOtherCards = player.hand.some(c => c.instanceId !== card.instanceId);
      if (!hasOtherCards) {
        return '手牌中没有其他牌可超度，无法使用骰子鬼';
      }
    }
    
    return null;
  }

  /**
   * 抽牌
   * @param player 玩家
   * @param count 抽牌数量
   * @note 手牌上限为10张，每次抽牌前检查，若手牌已满则跳过该次抽牌
   */
  private drawCards(player: PlayerState, count: number): void {
    const HAND_LIMIT = 10; // 手牌上限
    let actualDrawn = 0;
    
    for (let i = 0; i < count; i++) {
      // ⚠️ 手牌上限检查：若手牌已满（≥10张），跳过本次抓牌
      if (player.hand.length >= HAND_LIMIT) {
        this.addLog(`   ⚠️ ${player.name} 手牌已满（${HAND_LIMIT}张），跳过抓牌`);
        break; // 后续抓牌都无法进行，直接跳出
      }
      
      if (player.deck.length === 0) {
        // 洗入弃牌堆
        if (player.discard.length === 0) break;
        this.addLog(`🔄 ${player.name} 牌库耗尽，洗入弃牌堆`);
        player.deck = [...player.discard].sort(() => Math.random() - 0.5);
        player.discard = [];
        // 洗牌后清空所有展示状态
        DeckRevealHelper.clearAllRevealed(player);
      }
      const card = player.deck.shift();
      if (card) {
        // 清理展示状态（卡牌离开牌库）
        DeckRevealHelper.removeRevealedCard(player, card.instanceId);
        player.hand.push(card);
        actualDrawn++;
      }
    }
    // 式神引擎：广播抽牌事件（使用实际抽到的数量）
    this.emitSkillEvent(player, { type: 'CARDS_DRAWN', count: actualDrawn });
  }

  /**
   * 【原子操作】弃置卡牌
   * @param player 玩家
   * @param card 要弃置的卡牌（调用前需已从原区域移除）
   * @param type 'active' = 主动弃置（触发【触】效果），'rule' = 规则弃置（不触发）
   */
  private discard(player: PlayerState, card: CardInstance, type: 'active' | 'rule'): void {
    // 放入弃牌堆
    player.discard.push(card);

    // 仅主动弃置触发【触】效果
    if (type === 'active') {
      this.checkDiscardTrigger(player, card);
    }
  }

  /**
   * 【原子操作】批量弃置（用于回合末清理等场景）
   * @param player 玩家
   * @param cards 要弃置的卡牌数组
   * @param type 弃置类型
   */
  private discardMany(player: PlayerState, cards: CardInstance[], type: 'active' | 'rule'): void {
    for (const card of cards) {
      this.discard(player, card, type);
    }
  }

  /**
   * 检查主动弃置触发的【触】效果（内部方法）
   */
  private checkDiscardTrigger(player: PlayerState, card: CardInstance): void {
    // 树妖【触】：被弃置时抓牌+2
    if (card.name === '树妖') {
      this.drawCards(player, 2);
      this.addLog(`   🌳 树妖【触】效果：抓牌+2`);
    }
    // 三味【触】：被弃置时抓牌+3
    else if (card.name === '三味') {
      this.drawCards(player, 3);
      this.addLog(`   🎸 三味【触】效果：抓牌+3`);
    }
  }

  /** 与 drawCards 一致：至少还能从牌库/弃牌堆抓到 1 张时使用 */
  private canDrawOneFromPiles(player: PlayerState): boolean {
    const deckLen = player.deck?.length ?? 0;
    const discLen = player.discard?.length ?? 0;
    return deckLen > 0 || discLen > 0;
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

    // 地藏像特殊处理：需要二次确认
    // 如果当前没有等待确认状态，先触发确认对话框
    if (card.name === '地藏像' && !this.state.pendingChoice) {
      this.state.pendingChoice = {
        type: 'dizangConfirm',
        playerId: player.id,
        card: card,
        prompt: '确定打出地藏像？此牌将被超度'
      };
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: true };  // 等待玩家确认
    }

    // 单目标御魂：场上无合法目标时不可打出（策划文档《卡牌开发》§ 单目标效果与可用性）
    const yokaiTargetBlock = this.validateYokaiMustHaveTarget(card);
    if (yokaiTargetBlock) {
      return { success: false, error: yokaiTargetBlock };
    }
    
    // 移到已打出区域
    player.hand.splice(cardIndex, 1);
    player.played.push(card);
    player.cardsPlayed++;
    
    // 确保 damagePool 存在
    if (!this.state.damagePool) {
      this.state.damagePool = createEmptyDamagePool();
    }
    
    // 记录执行前的伤害值，用于计算伤害增量并追踪来源
    const damageBeforePlay = player.damage;
    
    // 阴阳术：累加伤害 + 检查Buff
    if (card.cardType === 'spell' && card.damage) {
      const bonusDamage = TempBuffHelper.consumeSpellDamageBonus(player);
      const totalDamage = card.damage + bonusDamage;
      player.damage += totalDamage;
      
      // 累加到 damagePool.spell（镜姬免疫此类伤害）
      const damageIncrement = player.damage - damageBeforePlay;
      this.state.damagePool.spell += damageIncrement;
      
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
        const yokaiDamage = card.damage * damageMultiplier;
        player.damage += yokaiDamage;
        this.addLog(`🎴 ${player.name} 打出御魂 ${card.name} (+${yokaiDamage}伤害)`);
      } else {
        this.addLog(`🎴 ${player.name} 打出御魂 ${card.name}`);
      }
      
      // 执行御魂效果（效果内部可能有额外伤害）
      this.executeYokaiEffect(player, card, damageMultiplier);
      
      // 计算御魂效果产生的总伤害增量，累加到 damagePool.yokai（镜姬不免疫）
      const damageIncrement = player.damage - damageBeforePlay;
      if (damageIncrement > 0) {
        this.state.damagePool.yokai += damageIncrement;
      }
    }
    // 其他卡牌（令牌等）
    else if (card.damage) {
      player.damage += card.damage;
      // 其他类型卡牌的伤害累加到 other
      const damageIncrement = player.damage - damageBeforePlay;
      if (damageIncrement > 0) {
        this.state.damagePool.other += damageIncrement;
      }
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
    
    const shikigami = player.shikigami[shikigamiIndex];

    // ── 优先使用新引擎 ──
    if (this.skillEngine.hasSkillDefs(shikigamiId)) {
      const activeSkills = this.skillEngine.getActiveSkills(shikigamiId);
      if (activeSkills.length === 0) {
        return { success: false, error: '该式神没有主动技能' };
      }
      // 默认取第一个主动技能（多技能式神后续扩展选择逻辑）
      const skillDef = activeSkills[0]!;
      const ctx = this.buildSkillContext(player, shikigami, shikigamiIndex);

      // 前置校验由引擎统一处理
      const error = this.skillEngine.canUseSkill(skillDef.skillId, ctx);
      if (error) {
        return { success: false, error };
      }

      // 同步执行（引擎方法是 async，这里用 Promise 链确保不阻塞事件循环）
      this.skillEngine.executeActiveSkill(skillDef.skillId, ctx).then(result => {
        if (!result.success) {
          // 执行失败日志（引擎内部已退还鬼火）
          this.addLog(`   ⚠️ ${skillDef.name} 执行失败: ${result.message}`);
        } else {
          // 触发针女效果：使用式神技能时伤害+2
          const skillDamageBonus = TempBuffHelper.consumeSkillDamageBonus(player);
          if (skillDamageBonus > 0) {
            player.damage += skillDamageBonus;
            this.addLog(`   ⚡ 针女触发：伤害+${skillDamageBonus}`);
          }
        }
        this.notifyStateChange();
      });

      return { success: true };
    }
    
    // ── Fallback: 旧 switch-case（引擎未注册的式神） ──
    const shikigamiState = player.shikigamiState[shikigamiIndex];
    if (shikigamiState.isExhausted) {
      return { success: false, error: '这个式神本回合已行动' };
    }
    
    // 计算涅槃之火减费效果
    const baseCost = shikigami.skill?.cost || 0;
    const costReduction = this.getSkillCostReduction(player);
    const actualCost = Math.max(0, baseCost - costReduction);
    
    if (player.ghostFire < actualCost) {
      return { success: false, error: `鬼火不足（需要${actualCost}，当前${player.ghostFire}）` };
    }
    
    player.ghostFire -= actualCost;
    
    // 日志提示减费效果
    if (costReduction > 0 && baseCost > 0) {
      this.addLog(`   🔥 涅槃之火减费: ${baseCost} → ${actualCost}`);
    }
    shikigamiState.isExhausted = true;
    
    const skillName = shikigami.skill?.name || '未知';
    this.addLog(`⚡ ${player.name} 使用 ${shikigami.name} 的技能：${skillName}`);
    
    this.executeShikigamiSkill(player, shikigami.id, skillName);
    
    // 触发针女效果：使用式神技能时伤害+2
    const skillDamageBonus = TempBuffHelper.consumeSkillDamageBonus(player);
    if (skillDamageBonus > 0) {
      player.damage += skillDamageBonus;
      this.addLog(`   ⚡ 针女触发：伤害+${skillDamageBonus}`);
    }
    
    this.notifyStateChange();
    
    return { success: true };
  }
  
  /**
   * 执行式神技能效果
   */
  /**
   * 构建引擎所需的 SkillContext
   * 将 MultiplayerGame 的方法注入为回调，使 shared 层代码可独立测试
   */
  private buildSkillContext(
    player: PlayerState,
    shikigami: ShikigamiCard,
    slotIndex: number
  ): SkillContext {
    const state = player.shikigamiState[slotIndex]!;
    // 类型断言：server/types 和 shared/types 存在字段差异，运行时兼容
    return {
      gameState: this.state as any,
      player: player as any,
      shikigami: shikigami as any,
      shikigamiState: state as any,
      slotIndex,
      opponents: this.state.players.filter(p => p.id !== player.id) as any[],
      // 交互回调（暂用占位，后续接入 Socket 交互）
      onSelectCards: async () => [],
      onSelectTarget: async () => '',
      onSelectMultiTargets: async () => [],
      onChoice: async () => 0,
      onInputNumber: async () => 1,
      // 工具函数
      drawCards: (p: any, count: number) => { this.drawCards(p, count); return count; },
      discardCard: (p: any, instanceId: string, type: 'active' | 'rule') => {
        const idx = p.hand.findIndex((c: any) => c.instanceId === instanceId);
        if (idx >= 0) {
          const [card] = p.hand.splice(idx, 1);
          this.discard(p, card, type);
        }
      },
      exileCard: (p, instanceId) => {
        const idx = p.hand.findIndex(c => c.instanceId === instanceId);
        if (idx >= 0) {
          const [card] = p.hand.splice(idx, 1);
          p.exiled.push(card);
        }
      },
      gainPenalty: (p: any) => {
        // 从恶评牌库顶取一张
        const penaltyDeck = (this.state.field as any).penaltyDeck as CardInstance[] | undefined;
        if (penaltyDeck && penaltyDeck.length > 0) {
          const penalty = penaltyDeck.shift()!;
          p.discard.push(penalty);
          this.addLog(`📛 ${p.name} 获得恶评「${penalty.name}」`);
        }
      },
      addLog: (msg: string) => this.addLog(msg),
      emitEvent: async (event) => {
        await this.skillEngine.emit(event, this.buildSkillContext(player, shikigami, slotIndex));
      },
    };
  }

  /**
   * 便捷方法：向玩家所有式神广播事件
   * 遍历该玩家的所有式神并构建 ctx，依次 emit
   */
  private async emitSkillEvent(player: PlayerState, event: { type: string; [key: string]: any }): Promise<void> {
    for (let i = 0; i < player.shikigami.length; i++) {
      const shiki = player.shikigami[i];
      if (!shiki) continue;
      const ctx = this.buildSkillContext(player, shiki, i);
      await this.skillEngine.emit(event as any, ctx);
    }
  }

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
    // 天邪鬼青以 cardId 为准，避免名称字段异常时误入 default 或其它分支
    const effectKey = card.cardId === 'yokai_004' ? '天邪鬼青' : (yokaiName || '');

    // 根据妖怪名称执行效果
    for (let m = 0; m < multiplier; m++) {
      switch (effectKey) {
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
            // 添加展示状态
            const topCard = DeckRevealHelper.revealTopCard(player, player.id);
            if (topCard) {
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
            }
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
              // 打出前已校验，不应到达；兜底避免静默消耗手牌
              this.addLog(`   ⚠️ 御魂：场上没有符合条件的妖怪（异常路径）`);
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
          
        case '天邪鬼青': {
          // 选择：抓牌+1 或 伤害+1；牌库与弃牌堆皆空时无法抓牌，仅结算伤害+1（与 drawCards 可执行条件一致）
          const canDrawAmanojakuAo = this.canDrawOneFromPiles(player);
          if (!canDrawAmanojakuAo) {
            player.damage += 1;
            this.addLog(`   ✨ 御魂：伤害+1`);
            break;
          }
          this.state.pendingChoice = {
            type: 'yokaiChoice',
            playerId: player.id,
            options: ['抓牌+1', '伤害+1'],
            prompt: '选择一个效果'
          };
          this.addLog(`   🎯 御魂：选择抓牌+1 或 伤害+1`);
          break;
        }
          
        case '天邪鬼赤':
          // 伤害+1，弃置任意数量手牌，抓等量的牌
          player.damage += 1;
          this.addLog(`   ✨ 御魂：伤害+1`);
          
          // 如果有手牌，让玩家选择要弃置的牌
          if (player.hand.length > 0) {
            this.state.pendingChoice = {
              type: 'selectCardsMulti',
              playerId: player.id,
              cards: player.hand.map(c => c.instanceId),
              maxCount: player.hand.length,
              minCount: 0,
              prompt: '选择要弃置的手牌（可不选）'
            };
            this.addLog(`   🎯 御魂：选择要弃置的手牌...`);
          }
          break;
          
        case '天邪鬼黄':
          // 抓牌+2，然后将1张手牌置于牌库顶
          this.drawCards(player, 2);
          this.addLog(`   ✨ 御魂：抓牌+2`);
          // 如果有手牌，弹出选择界面让玩家选1张置顶
          if (player.hand.length > 0) {
            this.state.pendingChoice = {
              type: 'selectCardPutTop',
              playerId: player.id,
              prompt: '选择1张手牌置于牌库顶',
              count: 1
            };
            this.addLog(`   ⏳ 等待选择1张手牌置于牌库顶...`);
          }
          break;
          
        case '赤舌': {
          // [妨害] 对手从弃牌堆选择基础术式或招福达摩置于牌库顶
          // 收集需要处理的对手及其弃牌堆情况
          console.log('[赤舌调试] 开始处理赤舌效果');
          const akajitaTargets: { playerId: string; playerName: string; hasSpell: boolean; hasDaruma: boolean; spellCard?: CardInstance; darumaCard?: CardInstance }[] = [];
          
          for (const opponent of this.state.players) {
            if (opponent.id === player.id) continue;
            
            // 筛选弃牌堆中的基础术式和招福达摩
            const spellCard = opponent.discard.find(c => c.name === '基础术式');
            const darumaCard = opponent.discard.find(c => c.name === '招福达摩');
            console.log(`[赤舌调试] 对手 ${opponent.name}(${opponent.id}): 基础术式=${!!spellCard}, 招福达摩=${!!darumaCard}`);
            
            if (spellCard || darumaCard) {
              akajitaTargets.push({
                playerId: opponent.id,
                playerName: opponent.name,
                hasSpell: !!spellCard,
                hasDaruma: !!darumaCard,
                spellCard,
                darumaCard
              });
            }
          }
          
          if (akajitaTargets.length === 0) {
            // 场景C：没有符合条件的牌，跳过
            this.addLog(`   ✨ 御魂：[妨害]对手弃牌堆无符合条件的牌`);
          } else {
            // 逐个处理对手（当前简化：同时处理所有对手）
            for (const target of akajitaTargets) {
              const opponent = this.getPlayer(target.playerId);
              if (!opponent) continue;
              
              if (target.hasSpell && target.hasDaruma) {
                // 场景A：两者都有，需要对手选择
                // 设置pendingChoice给该对手，5秒超时
                console.log(`[赤舌调试] 场景A: ${target.playerName} 两张都有，设置pendingChoice`);
                const deadline = Date.now() + 5000;
                this.state.pendingChoice = {
                  type: 'akajitaSelect',
                  playerId: target.playerId,
                  triggerPlayerId: player.id,  // 触发者
                  prompt: '赤舌：选择1张牌置于牌库顶',
                  deadline: deadline,  // 客户端使用deadline计算倒计时
                  options: [
                    { name: '基础术式', cardId: target.spellCard!.cardId },
                    { name: '招福达摩', cardId: target.darumaCard!.cardId }
                  ],
                  // 保留原始数据用于执行
                  candidates: [
                    { type: 'spell', name: '基础术式', instanceId: target.spellCard!.instanceId },
                    { type: 'daruma', name: '招福达摩', instanceId: target.darumaCard!.instanceId }
                  ]
                } as any;
                console.log(`[赤舌调试] pendingChoice已设置:`, JSON.stringify(this.state.pendingChoice));
                this.addLog(`   ⏳ 等待 ${target.playerName} 选择置于牌库顶的牌...`);
                // 设置5秒超时
                this.startAkajitaTimeout(target.playerId);
                // 立即通知状态变更
                this.notifyStateChange();
                break; // 一次只处理一个对手的选择
              } else {
                // 场景B：只有一种，自动选中
                const cardToMove = target.spellCard || target.darumaCard;
                if (cardToMove) {
                  const idx = opponent.discard.findIndex(c => c.instanceId === cardToMove.instanceId);
                  if (idx !== -1) {
                    const card = opponent.discard.splice(idx, 1)[0]!;
                    opponent.deck.unshift(card); // 置于牌库顶
                    
                    // 通知该玩家（通过akajitaNotify）
                    this.state.akajitaNotify = this.state.akajitaNotify || [];
                    (this.state as any).akajitaNotify.push({
                      playerId: target.playerId,
                      cardName: card.name,
                      timestamp: Date.now()
                    });
                    
                    this.addLog(`   ✨ ${target.playerName} 的【${card.name}】被置于牌库顶`);
                  }
                }
              }
            }
          }
          break;
        }
          
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
          this.addLog(`   ✨ 御魂：抓牌+2`);
          // 如果有手牌，让玩家选择要弃置的牌
          if (player.hand.length > 0) {
            this.state.pendingChoice = {
              type: 'treeDemonDiscard',
              playerId: player.id,
              prompt: '选择1张手牌弃置'
            };
            this.addLog(`   ⏳ 等待选择1张手牌弃置...`);
          }
          break;
          
        case '日女巳时':
          // 选择：鬼火+1 / 抓牌+2 / 伤害+2
          this.state.pendingChoice = {
            type: 'rinyuChoice',
            playerId: player.id,
            prompt: '选择一项效果',
            options: ['ghostFire', 'draw', 'damage'] // 鬼火+1, 抓牌+2, 伤害+2
          };
          this.addLog(`   ⏳ 等待选择：鬼火+1 / 抓牌+2 / 伤害+2`);
          break;
          
        case '蚌精':
          // 超度1张手牌，抓牌+2
          if (player.hand.length > 0) {
            this.state.pendingChoice = {
              type: 'bangJingExile',
              playerId: player.id,
              prompt: '选择1张手牌超度'
            };
            this.addLog(`   ⏳ 等待选择1张手牌超度...`);
          } else {
            // 无手牌时仅抓牌（根据策划文档：无手牌时不可打出，这里做兜底）
            this.drawCards(player, 2);
            this.addLog(`   ✨ 御魂：无手牌可超度，抓牌+2`);
          }
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
          
        case '魅妖': {
          // [妨害] 每名对手展示牌库顶牌，选择其中1张生命<5的可用牌，使用其效果，置入弃牌区
          // 1. 收集所有对手的牌库顶牌
          const meiYaoCandidates: { ownerId: string; ownerName: string; card: CardInstance; usable: boolean }[] = [];
          for (const opponent of this.state.players) {
            if (opponent.id === player.id) continue;
            if (opponent.deck.length > 0) {
              // 添加展示状态：当前玩家查看对手牌库顶
              const topCard = DeckRevealHelper.revealTopCard(opponent, player.id);
              if (!topCard) continue;
              
              // 筛选生命<5的牌（策划：生命低于5）
              if (topCard.hp !== undefined && topCard.hp < 5) {
                // 判断是否可用（令牌和恶评不能"使用其效果"）
                const isUsable = topCard.cardType !== 'token' && topCard.cardType !== 'penalty';
                meiYaoCandidates.push({
                  ownerId: opponent.id,
                  ownerName: opponent.name,
                  card: topCard,
                  usable: isUsable
                });
              }
              this.addLog(`   👁️ ${opponent.name} 牌库顶: ${topCard.name} (HP:${topCard.hp ?? '?'})`);
            }
          }

          // 统计可用牌数量
          const usableCount = meiYaoCandidates.filter(c => c.usable).length;

          if (meiYaoCandidates.length === 0) {
            // 没有HP<5的牌
            this.addLog(`   ✨ 御魂：无可选牌（对手牌库空或无HP<5的牌）`);
          } else if (usableCount === 0) {
            // 有候选牌但全是令牌/恶评，显示给玩家看（展示有价值），但需要取消按钮
            this.state.pendingChoice = {
              type: 'meiYaoSelect',
              playerId: player.id,
              prompt: `对手牌库顶均为不可用牌`,
              hasUsable: false,
              candidates: meiYaoCandidates.map(c => ({
                instanceId: c.card.instanceId,
                cardId: c.card.cardId,
                cardType: c.card.cardType,
                name: c.card.name,
                hp: c.card.hp,
                ownerName: c.ownerName,
                ownerId: c.ownerId,
                usable: c.usable
              }))
            } as any;
            this.addLog(`   ⏳ 对手牌库顶均为不可用牌...`);
          } else if (usableCount === 1 && meiYaoCandidates.length === 1) {
            // 只有一张可用牌且总共就一张，自动选择
            const target = meiYaoCandidates[0];
            this.executeMeiYaoEffect(player, target);
          } else {
            // 多张候选牌，需要玩家选择（传递所有牌，包括不可用的用于展示）
            this.state.pendingChoice = {
              type: 'meiYaoSelect',
              playerId: player.id,
              prompt: `选择1张对手牌库顶牌使用其效果（HP<5）`,
              hasUsable: true,
              candidates: meiYaoCandidates.map(c => ({
                instanceId: c.card.instanceId,
                cardId: c.card.cardId,
                cardType: c.card.cardType,
                name: c.card.name,
                hp: c.card.hp,
                ownerName: c.ownerName,
                ownerId: c.ownerId,
                usable: c.usable
              }))
            } as any;
            this.addLog(`   ⏳ 等待选择对手牌库顶牌...`);
          }
          break;
        }
          
        // ============ 生命4 ============
        case '骰子鬼': {
          // 超度1张手牌，退治生命不高于超度牌+2的妖怪
          if (player.hand.length === 0) {
            this.addLog(`   ✨ 御魂：没有手牌可超度`);
            break;
          }
          // 第一步：选择超度手牌
          this.state.pendingChoice = {
            type: 'diceGhostExile',
            playerId: player.id,
            prompt: '选择1张手牌超度',
            options: player.hand.map(c => ({
              instanceId: c.instanceId,
              name: c.name,
              hp: c.hp ?? 0,
              charm: (c as any).charm ?? 0
            }))
          };
          this.addLog(`   ⏳ 等待选择超度手牌...`);
          break;
        }
          
        case '涅槃之火':
          // 本回合式神技能鬼火消耗-1
          TempBuffHelper.addBuff(player, {
            type: 'SKILL_COST_REDUCTION',
            value: 1,
          });
          this.addLog(`   ✨ 御魂：式神技能费用-1`);
          break;
          
        case '雪幽魂': {
          // [妨害] 抓牌+1，对手弃置恶评或获得恶评
          this.drawCards(player, 1);
          this.addLog(`   ✨ 御魂：抓牌+1`);
          
          // 对每名对手执行妨害
          for (const opponent of this.state.players) {
            if (opponent.id === player.id) continue;
            
            // 检查对手手牌中的恶评
            const penaltyCards = opponent.hand.filter(c => c.cardType === 'penalty');
            
            if (penaltyCards.length > 0) {
              // 有恶评，需要弃置1张
              if (penaltyCards.length === 1) {
                // 只有1张恶评，自动弃置
                const cardToDiscard = penaltyCards[0]!;
                const idx = opponent.hand.findIndex(c => c.instanceId === cardToDiscard.instanceId);
                if (idx !== -1) {
                  opponent.discard.push(opponent.hand.splice(idx, 1)[0]!);
                  this.addLog(`   🗑️ [妨害] ${opponent.name} 弃置恶评「${cardToDiscard.name}」`);
                }
              } else {
                // 多张恶评，AI策略：优先弃置农夫（penalty_001）
                const farmer = penaltyCards.find(c => c.cardId === 'penalty_001');
                const cardToDiscard = farmer || penaltyCards[0]!;
                const idx = opponent.hand.findIndex(c => c.instanceId === cardToDiscard.instanceId);
                if (idx !== -1) {
                  opponent.discard.push(opponent.hand.splice(idx, 1)[0]!);
                  this.addLog(`   🗑️ [妨害] ${opponent.name} 弃置恶评「${cardToDiscard.name}」`);
                }
              }
            } else {
              // 无恶评，获得1张恶评
              this.givePenaltyCard(opponent);
              this.addLog(`   😈 [妨害] ${opponent.name} 无恶评可弃，获得恶评`);
            }
          }
          break;
        }
          
        case '轮入道': {
          // 弃置1张生命6以下的御魂，执行其效果2次
          // ⚠️ 排除轮入道自身，避免无限递归
          const validYokai = player.hand.filter(c => 
            c.cardType === 'yokai' && (c.hp || 0) <= 6 && c.name !== '轮入道'
          );
          
          if (validYokai.length === 0) {
            this.addLog(`   ⚠️ 御魂：手牌中没有生命≤6的御魂`);
          } else if (validYokai.length === 1) {
            // 只有一张符合条件，自动选择
            const target = validYokai[0]!;
            this.executeWheelMonkEffect(player, target.instanceId);
          } else {
            // 多张符合条件，让玩家选择
            this.state.pendingChoice = {
              type: 'wheelMonkDiscard',
              playerId: player.id,
              candidates: validYokai.map(c => c.instanceId),
              prompt: '选择要弃置的御魂（生命≤6），其效果将执行2次'
            };
            this.addLog(`   🎯 御魂：选择要弃置的御魂...`);
          }
          break;
          break;
        }
          
        case '网切':
          // 本回合所有妖怪HP-1，鬼王HP-2（全局 field 级别，覆盖不叠加）
          TempBuffHelper.applyNetCutterToField(this.state.field);
          this.addLog(`   ✨ 御魂：本回合妖怪HP-1，鬼王HP-2`);
          break;
          
        case '铮':
          // 抓牌+1，伤害+2
          this.drawCards(player, 1);
          player.damage += 2;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+2`);
          break;
          
        case '薙魂': {
          // 抓牌+1，弃置1张手牌。本回合打出≥3张御魂时鬼火+2
          this.drawCards(player, 1);
          this.addLog(`   ✨ 御魂：抓牌+1`);
          
          // 如果有手牌，让玩家选择要弃置的牌
          if (player.hand.length > 0) {
            this.state.pendingChoice = {
              type: 'naginataSoulDiscard',
              playerId: player.id,
              prompt: '选择1张手牌弃置'
            };
            this.addLog(`   ⏳ 等待选择1张手牌弃置...`);
          } else {
            // 无手牌可弃置时，直接检查御魂计数
            this.checkNaginataSoulGhostFire(player);
          }
          break;
        }
          
        case '魍魉之匣': {
          // 抓牌+1，伤害+1，【妨害】每名玩家展示牌库顶，由你决定保留或弃置
          this.drawCards(player, 1);
          player.damage += 1;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+1`);
          
          // 收集所有玩家（含自己）的牌库顶牌
          const wangliangTargets: { playerId: string; playerName: string; card: CardInstance | null }[] = [];
          for (const p of this.state.players) {
            if (p.deck.length > 0) {
              const topCard = p.deck[p.deck.length - 1]; // 不pop，先展示
              wangliangTargets.push({
                playerId: p.id,
                playerName: p.name,
                card: topCard
              });
              this.addLog(`   👁️ ${p.name} 牌库顶: ${topCard.name}`);
            } else {
              wangliangTargets.push({
                playerId: p.id,
                playerName: p.name,
                card: null
              });
              this.addLog(`   👁️ ${p.name} 牌库为空`);
            }
          }
          
          // 检查是否有至少一名玩家有牌库
          const hasAnyCard = wangliangTargets.some(t => t.card !== null);
          
          if (!hasAnyCard) {
            this.addLog(`   ⚠️ 所有玩家牌库为空，跳过妨害效果`);
          } else {
            // 将自己排在第一位，其余保持原有顺序
            const sortedTargets = [
              ...wangliangTargets.filter(t => t.playerId === player.id),
              ...wangliangTargets.filter(t => t.playerId !== player.id)
            ];
            // 设置 pendingChoice，传递所有玩家（含空牌库）
            this.state.pendingChoice = {
              type: 'wangliangChoice',
              playerId: player.id,
              prompt: '魍魉之匣：点选要弃置的牌库顶牌（未选中则保留）',
              allTargets: sortedTargets.map(t => ({
                playerId: t.playerId,
                playerName: t.playerName,
                card: t.card ? {
                  instanceId: t.card.instanceId,
                  cardId: t.card.cardId,
                  name: t.card.name,
                  hp: t.card.hp,
                  cardType: t.card.cardType
                } : null
              })),
              currentIndex: 0,
              decisions: [] as { playerId: string; action: 'keep' | 'discard' }[]
            };
            this.notifyStateChange();
            return; // 等待玩家响应
          }
          break;
        }
          
        // ============ 生命5 ============
        case '狂骨': {
          // 抓牌+1，伤害+X（X=打出瞬间鬼火；先于抓牌锁定）
          const kuangguDmg = player.ghostFire;
          this.drawCards(player, 1);
          player.damage += kuangguDmg;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+${kuangguDmg}`);
          break;
        }
          
        case '返魂香': {
          // [妨害] 抓牌+1，伤害+1，每名对手选择：弃置1张手牌或获得1张恶评
          this.drawCards(player, 1);
          player.damage += 1;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+1`);
          
          // 收集需要选择的对手
          const fhxOpponents = this.state.players.filter(p => p.id !== player.id);
          if (fhxOpponents.length > 0) {
            // 开始返魂香妨害流程
            this.startFanHunXiangHarassment(player.id, fhxOpponents);
          }
          break;
        }
          
        case '镇墓兽': {
          // 鬼火+1，抓牌+1，伤害+2，左手边玩家指定禁止退治目标
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.drawCards(player, 1);
          player.damage += 2;
          this.addLog(`   ✨ 御魂：鬼火+1，抓牌+1，伤害+2`);
          
          // 收集所有可选目标（游荡妖怪 + 鬼王）
          const zmsTargets: { instanceId: string; name: string; hp: number }[] = [];
          
          // 添加游荡区妖怪
          for (const yokai of this.state.field.yokaiSlots) {
            if (yokai && yokai.instanceId) {
              zmsTargets.push({
                instanceId: yokai.instanceId,
                name: yokai.name || '未知妖怪',
                hp: yokai.hp || 0
              });
            }
          }
          
          // 添加鬼王
          if (this.state.field.currentBoss && this.state.field.currentBoss.id) {
            zmsTargets.push({
              instanceId: this.state.field.currentBoss.id,
              name: this.state.field.currentBoss.name || '鬼王',
              hp: this.state.field.bossCurrentHp || 0
            });
          }
          
          if (zmsTargets.length > 0) {
            // 找到左手边玩家（顺时针下一位）
            const currentIdx = this.state.players.findIndex(p => p.id === player.id);
            const leftIdx = (currentIdx + 1) % this.state.players.length;
            const leftPlayer = this.state.players[leftIdx];
            
            if (leftPlayer.id === player.id) {
              // 只有自己一个玩家，AI 代选（HP最低）
              const sortedTargets = [...zmsTargets].sort((a, b) => a.hp - b.hp);
              if (!player.prohibitedTargets) player.prohibitedTargets = [];
              player.prohibitedTargets.push(sortedTargets[0].instanceId);
              this.addLog(`   🚫 镇墓兽：AI 指定 ${sortedTargets[0].name} 为禁止退治目标`);
            } else if (leftPlayer.isAI || leftPlayer.isOfflineHosted || !leftPlayer.isConnected) {
              // AI/离线玩家自动选择
              const sortedTargets = [...zmsTargets].sort((a, b) => a.hp - b.hp);
              if (!player.prohibitedTargets) player.prohibitedTargets = [];
              player.prohibitedTargets.push(sortedTargets[0].instanceId);
              this.addLog(`   🚫 镇墓兽：${leftPlayer.name} 指定 ${sortedTargets[0].name} 为禁止退治目标`);
            } else {
              // 等待左手边玩家选择
              this.state.pendingChoice = {
                type: 'zhenMuShouTarget',
                playerId: leftPlayer.id,
                candidates: zmsTargets.map(t => t.instanceId),
                restrictedPlayerId: player.id,
                prompt: `镇墓兽：选择一个目标，本回合 ${player.name} 不能将其退治`
              } as any;
              this.addLog(`   ⏳ 镇墓兽：等待 ${leftPlayer.name} 选择禁止退治目标...`);
            }
          } else {
            this.addLog(`   ⚠️ 镇墓兽：场上没有可选目标`);
          }
          break;
        }
          
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
          // 从弃牌区选择最多3张阴阳术置入手牌
          {
            const spellCards = player.discard.filter(c => c.cardType === 'spell');
            if (spellCards.length === 0) {
              this.addLog(`   ✨ 御魂：弃牌区没有阴阳术`);
            } else if (player.isAI) {
              // AI自动选择（优先高伤害）
              // 按伤害降序排序：高级符咒(+3) > 中级符咒(+2) > 基础术式(+1)
              const sorted = [...spellCards].sort((a, b) => {
                const damageA = a.name === '高级符咒' ? 3 : a.name === '中级符咒' ? 2 : 1;
                const damageB = b.name === '高级符咒' ? 3 : b.name === '中级符咒' ? 2 : 1;
                return damageB - damageA;
              });
              const count = Math.min(3, sorted.length);
              const selected = sorted.slice(0, count);
              for (const spell of selected) {
                const idx = player.discard.findIndex(c => c.instanceId === spell.instanceId);
                if (idx !== -1) {
                  player.hand.push(player.discard.splice(idx, 1)[0]);
                }
              }
              this.addLog(`   ✨ 御魂：从弃牌区取回${selected.map(s => s.name).join('、')}`);
            } else {
              // 真人玩家：触发选择交互
              const maxCount = Math.min(3, spellCards.length);
              this.state.pendingChoice = {
                type: 'tufoSelect',
                playerId: player.id,
                cards: spellCards,  // 传递完整卡牌对象，方便客户端显示
                maxCount,
                minCount: 0,
                prompt: `选择最多${maxCount}张阴阳术置入手牌`
              };
              this.addLog(`   ⏳ 等待选择阴阳术...`);
            }
          }
          break;
          
        case '地藏像': {
          // 地藏像效果：超度此牌，获取1个式神
          // 1. 超度此牌（从 played 移动到 exiled）
          const dizangIdx = player.played.findIndex(c => c.instanceId === card.instanceId);
          if (dizangIdx !== -1) {
            player.played.splice(dizangIdx, 1);
            player.exiled.push(card);
          }
          this.addLog(`   🙏 御魂：地藏像被超度`);
          
          // 2. 检查式神牌库
          const shikigamiDeck = this.state.shikigamiDeck ?? [];
          if (shikigamiDeck.length === 0) {
            this.addLog(`   ⚠️ 式神牌库为空，无法获取式神`);
            break;
          }
          
          // 3. 从式神牌库顶部抽取最多2张
          const drawCount = Math.min(2, shikigamiDeck.length);
          const drawnShikigami = shikigamiDeck.splice(0, drawCount);
          
          // 4. 存储抽取的式神到临时状态，供后续选择使用
          (this.state as any).dizangDrawnShikigami = drawnShikigami;
          (this.state as any).dizangPlayerId = player.id;
          (this.state as any).dizangNeedReplace = player.shikigami.length >= 3;
          
          // 5. AI 玩家自动选择
          if (player.isAI) {
            // AI策略：选择第一张（简化）
            const selectedShikigami = drawnShikigami[0];
            const unselected = drawnShikigami.slice(1);
            
            // 未选中的放回牌库底部
            shikigamiDeck.push(...unselected);
            
            if (player.shikigami.length >= 3) {
              // 式神已满：AI 选择替换价值最低的（简化为第一个）
              const replacedShikigami = player.shikigami.shift()!;
              shikigamiDeck.push(replacedShikigami);
              this.addLog(`   🔄 AI 替换式神：${replacedShikigami.name} → ${selectedShikigami.name}`);
            }
            
            // 获取新式神
            player.shikigami.push(selectedShikigami);
            this.addLog(`   ✨ 获取式神：${selectedShikigami.name}`);
            
            // 清理临时状态
            delete (this.state as any).dizangDrawnShikigami;
            delete (this.state as any).dizangPlayerId;
            delete (this.state as any).dizangNeedReplace;
          } else {
            // 真人玩家：触发式神选择交互
            if (drawCount === 1) {
              // 只有1张，无需选择，直接进入获取/置换流程
              const selectedShikigami = drawnShikigami[0];
              (this.state as any).dizangSelectedShikigami = selectedShikigami;
              
              if (player.shikigami.length >= 3) {
                // 式神已满，触发置换选择
                this.state.pendingChoice = {
                  type: 'dizangReplaceShikigami',
                  playerId: player.id,
                  newShikigami: selectedShikigami,
                  currentShikigami: player.shikigami,
                  prompt: `选择要替换的式神，或放弃获取 ${selectedShikigami.name}`
                };
                this.addLog(`   ⏳ 等待选择替换的式神...`);
              } else {
                // 直接获取
                player.shikigami.push(selectedShikigami);
                this.addLog(`   ✨ 获取式神：${selectedShikigami.name}`);
                delete (this.state as any).dizangDrawnShikigami;
                delete (this.state as any).dizangPlayerId;
                delete (this.state as any).dizangNeedReplace;
                delete (this.state as any).dizangSelectedShikigami;
              }
            } else {
              // 2张，触发二选一
              this.state.pendingChoice = {
                type: 'dizangSelectShikigami',
                playerId: player.id,
                candidates: drawnShikigami,
                prompt: '从2张式神中选择1张'
              };
              this.addLog(`   ⏳ 等待选择式神...`);
            }
          }
          break;
        }
          
        case '提灯小僧':
          // 鬼火+1
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.addLog(`   ✨ 御魂：鬼火+1`);
          break;
          
        // ============ 生命6 ============
        case '飞缘魔': {
          // 使用当前鬼王的御魂效果
          const boss = this.state.field.currentBoss;
          if (!boss) {
            this.addLog(`   ⚠️ 场上没有鬼王，飞缘魔效果无效`);
            break;
          }
          
          this.addLog(`   ✨ 飞缘魔 → 使用【${boss.name}】御魂效果`);
          
          // 异步调用共享层的鬼王御魂效果（同 executeBossArrivalEffect 模式）
          this.executeFeiYuanMoEffect(player, boss).catch(err => {
            this.addLog(`   ⚠️ 飞缘魔效果执行失败: ${err}`);
          });
          break;
        }
          
        case '破势': {
          // 伤害+3，若为本回合第一张牌则伤害+5
          // cardsPlayed 在打出卡牌后才递增，执行效果时当前牌尚未计入
          const isFirstCard = player.cardsPlayed === 0;
          const damage = isFirstCard ? 5 : 3;
          player.damage += damage;
          this.addLog(`   ✨ 御魂：伤害+${damage}${isFirstCard ? '（首张）' : ''}`);
          break;
        }
          
        case '镜姬':
          // 抓牌+2，伤害+1，鬼火+1
          this.drawCards(player, 2);
          player.damage += 1;
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.addLog(`   ✨ 御魂：抓牌+2，伤害+1，鬼火+1`);
          break;
          
        case '木魅': {
          // 从牌库顶展示直到出现3张阴阳术，阴阳术入手，其余弃置
          const revealedMuwei: CardInstance[] = [];
          const spellsMuwei: CardInstance[] = [];
          
          // 从牌库顶开始展示，直到找到3张阴阳术或牌库空
          while (player.deck.length > 0 && spellsMuwei.length < 3) {
            const card = player.deck.shift()!;
            revealedMuwei.push(card);
            
            if (card.cardType === 'spell') {
              spellsMuwei.push(card);
              this.addLog(`   📖 展示: ${card.name} (阴阳术 ${spellsMuwei.length}/3)`);
            } else {
              this.addLog(`   📖 展示: ${card.name}`);
            }
          }
          
          // 阴阳术置入手牌
          for (const spell of spellsMuwei) {
            player.hand.push(spell);
          }
          
          // 其余展示牌弃置
          const discardedMuwei: CardInstance[] = [];
          for (const card of revealedMuwei) {
            if (!spellsMuwei.includes(card)) {
              player.discard.push(card);
              discardedMuwei.push(card);
            }
          }
          
          const spellNamesMuwei = spellsMuwei.map(c => c.name).join('、') || '无';
          const discardNamesMuwei = discardedMuwei.map(c => c.name).join('、') || '无';
          this.addLog(`   ✨ 御魂：获得${spellsMuwei.length}张阴阳术 [${spellNamesMuwei}]，弃置${discardedMuwei.length}张 [${discardNamesMuwei}]`);
          break;
        }
          
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
   * 给予玩家恶评卡（【获得】→进入弃牌堆）
   */
  private givePenaltyCard(player: PlayerState): void {
    // 尝试从恶评牌库抽取
    let penaltyCard: CardInstance;
    if (this.state.field.penaltyPile && this.state.field.penaltyPile.length > 0) {
      penaltyCard = this.state.field.penaltyPile.pop()!;
    } else {
      // 牌库耗尽，创建农夫（无限供应）
      penaltyCard = {
        instanceId: `penalty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cardId: 'penalty_001',
        cardType: 'penalty',
        name: '农夫',
        charm: -1,
        hp: 0,
        maxHp: 0,
        image: '/images/cards/penalty/farmer.webp',
      };
    }
    // 【获得】规则：从公共牌堆获得的牌进入弃牌堆
    player.discard.push(penaltyCard);
    this.addLog(`   😞 ${player.name} 获得恶评「${penaltyCard.name}」(进入弃牌堆)`);
  }

  /**
   * 开始返魂香妨害流程
   * 让每名对手依次选择：弃置1张手牌 或 获得1张恶评
   */
  private startFanHunXiangHarassment(sourcePlayerId: string, opponents: PlayerState[]): void {
    // 存储待处理的对手列表
    (this.state as any).fanHunXiangQueue = opponents.map(p => p.id);
    (this.state as any).fanHunXiangSource = sourcePlayerId;
    
    // 处理第一个对手
    this.processNextFanHunXiangOpponent();
  }

  /**
   * 处理下一个返魂香妨害对手
   */
  private processNextFanHunXiangOpponent(): void {
    const queue = (this.state as any).fanHunXiangQueue as string[] | undefined;
    if (!queue || queue.length === 0) {
      // 所有对手处理完毕，清理状态
      delete (this.state as any).fanHunXiangQueue;
      delete (this.state as any).fanHunXiangSource;
      
      // 检查轮入道队列
      this.checkAndContinueWheelMonkQueue();
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return;
    }
    
    const opponentId = queue[0];
    const opponent = this.getPlayer(opponentId);
    if (!opponent) {
      // 对手不存在，跳过
      queue.shift();
      this.processNextFanHunXiangOpponent();
      return;
    }
    
    // 检查对手是否有手牌
    const hasHandCards = opponent.hand.length > 0;
    
    if (!hasHandCards) {
      // 无手牌，直接获得恶评
      this.givePenaltyCard(opponent);
      this.addLog(`   😈 [妨害] ${opponent.name} 无手牌，获得恶评`);
      queue.shift();
      this.processNextFanHunXiangOpponent();
      return;
    }
    
    // 有手牌，让对手选择
    this.state.pendingChoice = {
      type: 'fanHunXiangChoice',
      playerId: opponentId,
      prompt: '返魂香：选择一项',
      options: ['弃置1张手牌', '获得1张恶评']
    };
    
    this.addLog(`   🔥 [妨害] ${opponent.name} 需要选择：弃牌或获得恶评`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
  }

  /**
   * 处理返魂香选择响应
   */
  public handleFanHunXiangChoiceResponse(playerId: string, choice: number): { success: boolean; error?: string } {
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'fanHunXiangChoice') {
      return { success: false, error: '当前无返魂香选择' };
    }
    
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }
    
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: '玩家不存在' };
    }
    
    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    if (choice === 0) {
      // 选择弃置手牌
      if (player.hand.length > 0) {
        // AI策略：弃置价值最低的牌（HP最低）
        const sortedHand = [...player.hand].sort((a, b) => (a.hp || 0) - (b.hp || 0));
        const cardToDiscard = sortedHand[0]!;
        const idx = player.hand.findIndex(c => c.instanceId === cardToDiscard.instanceId);
        if (idx !== -1) {
          player.discard.push(player.hand.splice(idx, 1)[0]!);
          this.addLog(`   🗑️ [妨害] ${player.name} 弃置「${cardToDiscard.name}」`);
        }
      }
    } else {
      // 选择获得恶评
      this.givePenaltyCard(player);
      this.addLog(`   😈 [妨害] ${player.name} 选择获得恶评`);
    }
    
    // 从队列中移除当前对手，处理下一个
    const queue = (this.state as any).fanHunXiangQueue as string[] | undefined;
    if (queue && queue.length > 0) {
      queue.shift();
    }
    
    this.processNextFanHunXiangOpponent();
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
    
    // 计算网切修正后的鬼王有效HP（网切: 鬼王HP-2，最低1）
    const bossBaseHp = this.state.field.bossCurrentHp;
    const bossEffectiveHp = TempBuffHelper.getNetCutterEffectiveHp(this.state.field, bossBaseHp, 'boss');
    
    // 消耗伤害
    player.damage -= damage;
    
    // 造成伤害
    this.state.field.bossCurrentHp -= damage;
    
    if (bossEffectiveHp !== bossBaseHp) {
      this.addLog(`⚔️ ${player.name} 对 ${this.state.field.currentBoss.name} 造成 ${damage} 点伤害（网切: HP ${bossBaseHp}→${bossEffectiveHp}）`);
    } else {
      this.addLog(`⚔️ ${player.name} 对 ${this.state.field.currentBoss.name} 造成 ${damage} 点伤害`);
    }
    
    // 检查鬼王是否死亡（基于有效HP判定）
    if (damage >= bossEffectiveHp) {
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
    
    // 检查伤害是否足够（考虑网切修正：妖怪HP-1，最低1）
    const yokaiBaseHp = yokai.hp || 1;
    const yokaiEffectiveHp = TempBuffHelper.getNetCutterEffectiveHp(this.state.field, yokaiBaseHp, 'yokai');
    if (damage < yokaiEffectiveHp) {
      return { success: false, error: `伤害不足以击败妖怪（需要${yokaiEffectiveHp}）` };
    }
    
    // 消耗伤害
    player.damage -= damage;
    
    // 击败妖怪（声誉会在notifyStateChange时自动重新计算）
    this.markTurnHadKill();
    this.state.field.yokaiSlots[slotIndex] = null;
    this.ensureYokaiDiscardFaceStats(yokai);
    player.discard.push(yokai);
    
    if (yokaiEffectiveHp !== yokaiBaseHp) {
      this.addLog(`💀 ${player.name} 击败 ${yokai.name}，获得 ${yokai.charm || 0} 声誉（网切: HP ${yokaiBaseHp}→${yokaiEffectiveHp}）`);
    } else {
      this.addLog(`💀 ${player.name} 击败 ${yokai.name}，获得 ${yokai.charm || 0} 声誉`);
    }
    
    this.notifyStateChange({
      type: 'YOKAI_DEFEATED',
      card: yokai,
      playerId: player.id,
    });
    
    return { success: true };
  }

  /**
   * 击败鬼王
   * 注意：鬼王翻出时机在清理阶段（抽牌后），不在这里立即翻出
   */
  private defeatBoss(player: PlayerState): void {
    const boss = this.state.field.currentBoss!;
    this.markTurnHadKill();

    // 鬼王进入弃牌堆（声誉会在notifyStateChange时自动重新计算）
    player.discard.push(boss as any);
    
    this.addLog(`👹 ${player.name} 击败鬼王 ${boss.name}！获得 ${boss.charm || 0} 声誉`);
    
    // 清理鬼王特殊效果
    this.clearBossEffect(boss.name);
    
    // 检查游戏是否结束
    if (this.state.field.bossDeck.length === 0) {
      // 标记游戏将在清理阶段结束
      (this.state as any).pendingGameEnd = true;
    } else {
      // 标记需要在清理阶段翻出新鬼王（抽牌后、清空伤害前）
      (this.state as any).pendingBossReveal = true;
    }
    
    // 清空当前鬼王（已被击败）
    this.state.field.currentBoss = null;
    this.state.field.bossCurrentHp = 0;
    
    this.notifyStateChange({
      type: 'BOSS_DEFEATED',
      boss,
      playerId: player.id,
    });
  }
  
  /**
   * 清理鬼王特殊效果
   * 当鬼王被击败时调用，用于恢复被鬼王影响的状态
   */
  private clearBossEffect(bossName: string): void {
    switch (bossName) {
      case '八岐大蛇':
        // 恢复式神能力
        this.addLog(`   🔄 八岐大蛇离场，式神能力恢复`);
        for (const player of this.state.players) {
          for (let i = 0; i < player.shikigamiState.length; i++) {
            if ((player.shikigamiState[i] as any)?.flipped) {
              player.shikigamiState[i] = {
                ...player.shikigamiState[i],
                flipped: false
              } as any;
            }
          }
        }
        break;
        
      case '地震鲶':
        // 释放隐藏在阴阳师下的牌
        this.addLog(`   🔄 地震鲶离场，隐藏手牌弃置`);
        for (const player of this.state.players) {
          // 移除地震鲶buff
          const buffIdx = player.tempBuffs.findIndex((b: any) => b.source === '地震鲶');
          if (buffIdx !== -1) {
            player.tempBuffs.splice(buffIdx, 1);
          }
          
          // 将隐藏牌弃置（如果有实现hiddenCards字段）
          if ((player as any).hiddenCards && (player as any).hiddenCards.length > 0) {
            for (const card of (player as any).hiddenCards) {
              player.discard.push(card);
              this.addLog(`      ${player.name} 的隐藏牌 ${card.name} 被弃置`);
            }
            (player as any).hiddenCards = [];
          }
        }
        break;
    }
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
        // 清理展示状态（卡牌离开牌库）
        DeckRevealHelper.removeRevealedCard(player, card.instanceId);
        player.exiled.push(card);
        this.addLog(`   ✨ ${player.name} 超度了 ${card.name}`);
      }
    } else {
      this.addLog(`   ↩️ ${player.name} 选择不超度`, { visibility: 'private', playerId });
    }
    
    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();
    
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
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
  }

  /**
   * 处理御魂二选一响应（天邪鬼青等）
   * @param playerId 玩家ID（socket.id）
   * @param choiceIndex 选项下标（按客户端展示的 options 顺序；仅一项时可能为 0 且文案为「伤害+1」）
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

    const options = (this.state.pendingChoice.options || []) as string[];
    const idx = Number.isFinite(choiceIndex) ? choiceIndex : 0;
    const picked = options[idx] ?? options[0] ?? '';
    const isDraw = typeof picked === 'string' && picked.includes('抓牌');

    if (isDraw) {
      if (!this.canDrawOneFromPiles(player)) {
        player.damage += 1;
        this.addLog(`   ✨ 御魂：伤害+1`);
      } else {
        this.drawCards(player, 1);
        this.addLog(`   ✨ 御魂：抓牌+1`);
      }
    } else {
      player.damage += 1;
      this.addLog(`   ✨ 御魂：伤害+1`);
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理多选手牌响应（天邪鬼赤等卡牌效果）
   * @param playerId 玩家ID
   * @param selectedIds 选择的手牌instanceId数组
   */
  public handleSelectCardsMultiResponse(playerId: string, selectedIds: string[]): { success: boolean; error?: string } {
    // 验证是否有等待的多选
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'selectCardsMulti') {
      return { success: false, error: '没有待处理的手牌选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const ids = selectedIds || [];
    const discardCount = ids.length;

    if (discardCount > 0) {
      // 弃置选中的手牌（主动弃置，触发【触】）
      for (const id of ids) {
        const idx = player.hand.findIndex(c => c.instanceId === id);
        if (idx !== -1) {
          const card = player.hand.splice(idx, 1)[0]!;
          this.discard(player, card, 'active');
        }
      }
      // 抓取等量的牌
      this.drawCards(player, discardCount);
      this.addLog(`   ✨ 御魂：弃置${discardCount}张牌，抓${discardCount}张牌`);
    } else {
      this.addLog(`   ↩️ ${player.name} 选择不换牌`, { visibility: 'private', playerId });
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理涂佛选择阴阳术响应
   * @param playerId 玩家ID
   * @param selectedIds 选择的阴阳术instanceId数组
   */
  public handleTufoSelectResponse(playerId: string, selectedIds: string[]): { success: boolean; error?: string } {
    // 验证是否有等待的涂佛选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'tufoSelect') {
      return { success: false, error: '没有待处理的涂佛选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const ids = selectedIds || [];
    const selectedCount = ids.length;

    if (selectedCount > 0) {
      const selectedNames: string[] = [];
      // 将选中的阴阳术从弃牌区移到手牌
      for (const id of ids) {
        const idx = player.discard.findIndex(c => c.instanceId === id);
        if (idx !== -1) {
          const card = player.discard.splice(idx, 1)[0]!;
          player.hand.push(card);
          selectedNames.push(card.name);
        }
      }
      this.addLog(`   ✨ 御魂：从弃牌区取回${selectedNames.join('、')}`);
    } else {
      this.addLog(`   ↩️ ${player.name} 选择不取回阴阳术`, { visibility: 'private', playerId });
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  // ============ 地藏像响应处理 ============

  /**
   * 处理地藏像二次确认响应
   * @param playerId 玩家ID
   * @param confirm 是否确认打出
   */
  public handleDizangConfirmResponse(playerId: string, confirm: boolean): { success: boolean; error?: string } {
    // 验证是否有等待的地藏像确认
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'dizangConfirm') {
      return { success: false, error: '没有待处理的地藏像确认' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const dizangCard = this.state.pendingChoice.card;
    
    // 清除等待状态
    this.state.pendingChoice = undefined;

    if (!confirm) {
      // 取消打出
      this.addLog(`   ↩️ ${player.name} 取消打出地藏像`);
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: true };
    }

    // 确认打出：执行正常的打牌流程
    if (!dizangCard) {
      return { success: false, error: '地藏像卡牌信息丢失' };
    }

    // 从手牌移除并执行效果
    const cardIndex = player.hand.findIndex(c => c.instanceId === dizangCard.instanceId);
    if (cardIndex === -1) {
      return { success: false, error: '手牌中没有这张牌' };
    }

    // 移到已打出区域
    player.hand.splice(cardIndex, 1);
    player.played.push(dizangCard);
    player.cardsPlayed++;

    this.addLog(`🎴 ${player.name} 打出御魂 地藏像`);

    // 执行地藏像效果
    this.executeYokaiEffect(player, dizangCard, 1);

    this.notifyStateChange({ type: 'CARD_PLAYED', playerId, card: dizangCard });
    return { success: true };
  }

  /**
   * 处理地藏像式神选择响应
   * @param playerId 玩家ID
   * @param selectedIndex 选择的式神索引（0 或 1）
   */
  public handleDizangSelectShikigamiResponse(playerId: string, selectedIndex: number): { success: boolean; error?: string } {
    // 验证是否有等待的式神选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'dizangSelectShikigami') {
      return { success: false, error: '没有待处理的式神选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const drawnShikigami = (this.state as any).dizangDrawnShikigami as any[];
    if (!drawnShikigami || drawnShikigami.length === 0) {
      this.state.pendingChoice = undefined;
      return { success: false, error: '式神数据丢失' };
    }

    // 验证索引
    const idx = Math.max(0, Math.min(selectedIndex, drawnShikigami.length - 1));
    const selectedShikigami = drawnShikigami[idx];
    const unselected = drawnShikigami.filter((_, i) => i !== idx);

    // 未选中的放回牌库底部
    const shikigamiDeck = this.state.shikigamiDeck ?? [];
    shikigamiDeck.push(...unselected);

    // 存储选中的式神
    (this.state as any).dizangSelectedShikigami = selectedShikigami;

    // 清除等待状态
    this.state.pendingChoice = undefined;

    // 检查是否需要置换
    if (player.shikigami.length >= 3) {
      // 式神已满，触发置换选择
      this.state.pendingChoice = {
        type: 'dizangReplaceShikigami',
        playerId: player.id,
        newShikigami: selectedShikigami,
        currentShikigami: player.shikigami,
        prompt: `选择要替换的式神，或放弃获取 ${selectedShikigami.name}`
      };
      this.addLog(`   ⏳ 等待选择替换的式神...`);
    } else {
      // 直接获取
      player.shikigami.push(selectedShikigami);
      this.addLog(`   ✨ 获取式神：${selectedShikigami.name}`);

      // 清理临时状态
      delete (this.state as any).dizangDrawnShikigami;
      delete (this.state as any).dizangPlayerId;
      delete (this.state as any).dizangNeedReplace;
      delete (this.state as any).dizangSelectedShikigami;
    }

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理地藏像式神置换响应
   * @param playerId 玩家ID
   * @param replaceIndex 要替换的式神索引，null 表示放弃获取
   */
  public handleDizangReplaceShikigamiResponse(playerId: string, replaceIndex: number | null): { success: boolean; error?: string } {
    // 验证是否有等待的置换选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'dizangReplaceShikigami') {
      return { success: false, error: '没有待处理的式神置换' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const selectedShikigami = (this.state as any).dizangSelectedShikigami;
    const shikigamiDeck = this.state.shikigamiDeck ?? [];

    // 清除等待状态
    this.state.pendingChoice = undefined;

    if (replaceIndex === null || replaceIndex < 0 || replaceIndex >= player.shikigami.length) {
      // 放弃获取：选中的式神放回牌库底部
      if (selectedShikigami) {
        shikigamiDeck.push(selectedShikigami);
      }
      this.addLog(`   ❌ ${player.name} 放弃获取式神`);
    } else {
      // 执行替换
      const replacedShikigami = player.shikigami.splice(replaceIndex, 1)[0];
      shikigamiDeck.push(replacedShikigami);
      player.shikigami.push(selectedShikigami);
      this.addLog(`   🔄 替换式神：${replacedShikigami.name} → ${selectedShikigami.name}`);
    }

    // 清理临时状态
    delete (this.state as any).dizangDrawnShikigami;
    delete (this.state as any).dizangPlayerId;
    delete (this.state as any).dizangNeedReplace;
    delete (this.state as any).dizangSelectedShikigami;

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理选择手牌置顶响应（天邪鬼黄等）
   * @param playerId 玩家ID
   * @param selectedId 选择的手牌instanceId
   */
  public handleSelectCardPutTopResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的置顶选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'selectCardPutTop') {
      return { success: false, error: '没有待处理的置顶选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 从手牌中找到并移除选中的牌
    const idx = player.hand.findIndex(c => c.instanceId === selectedId);
    if (idx === -1) {
      // 超时/默认：选第一张
      if (player.hand.length > 0) {
        const card = player.hand.shift()!;
        // 牌库顶 = 数组头部(索引0)，用 unshift
        player.deck.unshift(card);
        // 记录这张牌可被查看（玩家自己放置的，应该可以查看）
        DeckRevealHelper.revealTopCard(player, playerId);
        this.addLog(`   📥 ${card.name} 被置于牌库顶（默认）`);
      }
    } else {
      const card = player.hand.splice(idx, 1)[0]!;
      // 牌库顶 = 数组头部(索引0)，用 unshift
      player.deck.unshift(card);
      // 记录这张牌可被查看（玩家自己放置的，应该可以查看）
      DeckRevealHelper.revealTopCard(player, playerId);
      this.addLog(`   📥 ${card.name} 被置于牌库顶`);
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理轮入道弃牌选择响应
   * @param playerId 玩家ID
   * @param selectedId 选择的御魂instanceId
   */
  public handleWheelMonkDiscardResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的轮入道弃牌选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'wheelMonkDiscard') {
      return { success: false, error: '没有待处理的轮入道弃牌选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 验证选择是否合法
    const candidates = (this.state.pendingChoice as any).candidates || [];
    
    // 🔑 先清除 pendingChoice，再执行轮入道效果
    // 轮入道队列内部通过 !pendingChoice 检查来决定是否继续执行下一次
    // 如果不先清除，wheelMonkDiscard 类型的 pendingChoice 会阻止第二次执行
    this.state.pendingChoice = undefined;
    
    if (!candidates.includes(selectedId)) {
      // 超时/默认：选第一张
      if (candidates.length > 0) {
        this.executeWheelMonkEffect(player, candidates[0]);
      }
    } else {
      this.executeWheelMonkEffect(player, selectedId);
    }

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 执行轮入道效果：弃置指定御魂，执行其效果2次
   * @param player 玩家
   * @param instanceId 要弃置的御魂instanceId
   */
  private executeWheelMonkEffect(player: PlayerState, instanceId: string): void {
    // 从手牌中找到并弃置
    const idx = player.hand.findIndex(c => c.instanceId === instanceId);
    if (idx === -1) {
      this.addLog(`   ⚠️ 轮入道：未找到指定御魂`);
      return;
    }
    
    const targetCard = player.hand.splice(idx, 1)[0]!;
    this.discard(player, targetCard, 'active');
    this.addLog(`   🎴 轮入道：弃置${targetCard.name}，执行效果×2`);
    
    // 初始化轮入道执行队列（完整执行2次，每次包含交互选择）
    this.state.wheelMonkQueue = {
      cardName: targetCard.name || '',
      cardId: targetCard.cardId || '',
      remainingExecutions: 2,
      playerId: player.id
    };
    
    // 执行第一次完整效果
    this.continueWheelMonkQueue();
  }
  
  /**
   * 继续执行轮入道队列中的下一次效果
   * 每次调用执行一次完整效果（包含交互选择）
   */
  private continueWheelMonkQueue(): void {
    const queue = this.state.wheelMonkQueue;
    if (!queue || queue.remainingExecutions <= 0) {
      this.clearWheelMonkQueue();
      return;
    }
    
    const player = this.getPlayer(queue.playerId);
    if (!player) {
      this.clearWheelMonkQueue();
      return;
    }
    
    const executionNumber = 3 - queue.remainingExecutions; // 1 或 2
    this.addLog(`   🔄 轮入道第${executionNumber}次执行：${queue.cardName}`);
    
    // 调用完整的御魂效果执行（会触发pendingChoice等待玩家响应）
    this.executeYokaiEffectForWheelMonk(player, queue.cardName);
    
    // 如果效果没有触发交互（无pendingChoice），直接继续下一次
    if (!this.state.pendingChoice) {
      queue.remainingExecutions--;
      if (queue.remainingExecutions > 0) {
        this.continueWheelMonkQueue();
      } else {
        this.clearWheelMonkQueue();
      }
    }
    // 如果有pendingChoice，等待玩家响应后在handleXxxResponse中调用checkAndContinueWheelMonkQueue
    
    // ⚠️ 关键：必须通知客户端状态变更（pendingChoice需要客户端显示选择框）
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
  }
  
  /**
   * 检查并继续轮入道队列（在交互响应处理完成后调用）
   */
  private checkAndContinueWheelMonkQueue(): void {
    const queue = this.state.wheelMonkQueue;
    if (!queue) return;
    
    queue.remainingExecutions--;
    
    if (queue.remainingExecutions > 0) {
      // 还有剩余执行次数，继续下一次
      this.continueWheelMonkQueue();
    } else {
      // 执行完毕，清空队列
      this.clearWheelMonkQueue();
    }
  }
  
  /**
   * 清空轮入道队列
   */
  private clearWheelMonkQueue(): void {
    if (this.state.wheelMonkQueue) {
      this.addLog(`   ✅ 轮入道效果执行完毕`);
      this.state.wheelMonkQueue = undefined;
    }
  }
  
  /**
   * 为轮入道执行完整御魂效果（复用executeYokaiEffect的switch-case逻辑）
   */
  private executeYokaiEffectForWheelMonk(player: PlayerState, effectKey: string): void {
    // 调用现有的executeYokaiEffect分支逻辑
    // 这里需要复用现有的switch-case，但跳过轮入道本身避免无限递归
    this.executeYokaiEffectByName(player, effectKey);
  }
  
  /**
   * 根据御魂名称执行完整效果（含交互）
   * 用于轮入道队列执行
   */
  private executeYokaiEffectByName(player: PlayerState, effectKey: string): void {
    // 复用executeYokaiEffect中的switch-case逻辑（跳过轮入道本身避免递归）
    switch (effectKey) {
      // ============ 树妖 ============
      case '树妖':
        // 抓牌+2，弃置1张
        this.drawCards(player, 2);
        if (player.hand.length > 0) {
          this.state.pendingChoice = {
            type: 'treeDemonDiscard',
            playerId: player.id,
            prompt: '选择1张手牌弃置（树妖效果）'
          };
          this.addLog(`   🌳 树妖：抓牌+2，请选择弃置1张手牌`);
        } else {
          this.addLog(`   🌳 树妖：抓牌+2（无手牌可弃）`);
        }
        break;
        
      // ============ 唐纸伞妖 ============
      case '唐纸伞妖':
        // 伤害+1，查看牌库顶牌，可选超度
        player.damage += 1;
        this.addLog(`   ✨ 唐纸伞妖：伤害+1`);
        if (player.deck.length > 0) {
          const topCard = DeckRevealHelper.revealTopCard(player, player.id);
          if (topCard) {
            this.state.pendingChoice = {
              type: 'salvageChoice',
              playerId: player.id,
              card: topCard,
              prompt: `查看牌库顶牌【${topCard.name}】，是否超度？`
            };
            this.addLog(`   👁️ 查看牌库顶牌：${topCard.name}`, { visibility: 'private', playerId: player.id });
          }
        } else {
          this.addLog(`   ⚠️ 牌库为空，无法查看`, { visibility: 'private', playerId: player.id });
        }
        break;
        
      // ============ 天邪鬼绿 ============
      case '天邪鬼绿': {
        // 退治1个生命≤4的游荡妖怪
        const validTargets = this.state.field.yokaiSlots
          .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= 4 && (y.hp || 0) > 0);
        
        if (validTargets.length === 0) {
          this.addLog(`   ⚠️ 天邪鬼绿：场上没有符合条件的妖怪`);
        } else if (validTargets.length === 1) {
          // 只有一个目标时自动选择
          const target = validTargets[0];
          const idx = this.state.field.yokaiSlots.findIndex(y => y?.instanceId === target.instanceId);
          if (idx !== -1) {
            this.state.field.yokaiSlots[idx] = null;
            this.ensureYokaiDiscardFaceStats(target);
            player.discard.push(target);
            this.addLog(`   ✨ 天邪鬼绿：退治${target.name}`);
          }
        } else {
          // 多个目标时让玩家选择
          this.state.pendingChoice = {
            type: 'yokaiTarget',
            playerId: player.id,
            prompt: '选择要退治的妖怪（生命≤4）',
            options: validTargets.map(y => y.instanceId),
          };
          this.addLog(`   🎯 天邪鬼绿：选择退治目标...`);
        }
        break;
      }
        
      // ============ 天邪鬼青 ============
      case '天邪鬼青': {
        // 选择：抓牌+1 或 伤害+1
        const canDraw = this.canDrawOneFromPiles(player);
        if (!canDraw) {
          player.damage += 1;
          this.addLog(`   ✨ 天邪鬼青：伤害+1（无法抓牌）`);
        } else {
          this.state.pendingChoice = {
            type: 'yokaiChoice',
            playerId: player.id,
            options: ['抓牌+1', '伤害+1'],
            prompt: '选择一个效果'
          };
          this.addLog(`   🎯 天邪鬼青：选择抓牌+1 或 伤害+1`);
        }
        break;
      }
        
      // ============ 天邪鬼赤 ============
      case '天邪鬼赤':
        // 伤害+1，弃置任意数量手牌，抓等量的牌
        player.damage += 1;
        this.addLog(`   ✨ 天邪鬼赤：伤害+1`);
        if (player.hand.length > 0) {
          this.state.pendingChoice = {
            type: 'selectCardsMulti',
            playerId: player.id,
            cards: player.hand.map(c => c.instanceId),
            maxCount: player.hand.length,
            minCount: 0,
            prompt: '选择要弃置的手牌（可不选）'
          };
          this.addLog(`   🎯 天邪鬼赤：选择要弃置的手牌...`);
        }
        break;
        
      // ============ 天邪鬼黄 ============
      case '天邪鬼黄':
        // 抓牌+2，然后将1张手牌置于牌库顶
        this.drawCards(player, 2);
        this.addLog(`   ✨ 天邪鬼黄：抓牌+2`);
        if (player.hand.length > 0) {
          this.state.pendingChoice = {
            type: 'selectCardPutTop',
            playerId: player.id,
            prompt: '选择1张手牌置于牌库顶',
            count: 1
          };
          this.addLog(`   ⏳ 天邪鬼黄：等待选择1张手牌置于牌库顶...`);
        }
        break;
        
      // ============ 日女巳时 ============
      case '日女巳时':
        // 选择：鬼火+1 / 抓牌+2 / 伤害+2
        this.state.pendingChoice = {
          type: 'rinyuChoice',
          playerId: player.id,
          prompt: '选择一项效果',
          options: ['ghostFire', 'draw', 'damage']
        };
        this.addLog(`   ⏳ 日女巳时：等待选择鬼火+1 / 抓牌+2 / 伤害+2`);
        break;
        
      // ============ 蚌精 ============
      case '蚌精':
        // 超度1张手牌，抓牌+2
        if (player.hand.length > 0) {
          this.state.pendingChoice = {
            type: 'bangJingExile',
            playerId: player.id,
            prompt: '选择1张手牌超度'
          };
          this.addLog(`   ⏳ 蚌精：等待选择1张手牌超度...`);
        } else {
          this.drawCards(player, 2);
          this.addLog(`   ✨ 蚌精：无手牌可超度，抓牌+2`);
        }
        break;
        
      // ============ 骰子鬼 ============
      case '骰子鬼':
        // 超度1张手牌，退治生命不高于超度牌+2的妖怪
        if (player.hand.length === 0) {
          this.addLog(`   ✨ 骰子鬼：没有手牌可超度`);
        } else {
          this.state.pendingChoice = {
            type: 'diceGhostExile',
            playerId: player.id,
            prompt: '选择1张手牌超度',
            options: player.hand.map(c => ({
              instanceId: c.instanceId,
              name: c.name,
              hp: c.hp ?? 0,
              charm: (c as any).charm ?? 0
            }))
          };
          this.addLog(`   ⏳ 骰子鬼：等待选择超度手牌...`);
        }
        break;
        
      // ============ 赤舌（妨害，对手选择）============
      case '赤舌': {
        // [妨害] 对手将弃牌堆的基础术式或招福达摩置于牌库顶
        // 完整执行：让对手选择，超时时自动AI策略
        const opponents = this.state.players.filter(p => p.id !== player.id);
        const akajitaTargets: {
          playerId: string;
          playerName: string;
          hasSpell: boolean;
          hasDaruma: boolean;
          spellCard?: CardInstance;
          darumaCard?: CardInstance;
        }[] = [];
        
        for (const opp of opponents) {
          const spellCard = opp.discard.find(c => c.name === '基础术式');
          const darumaCard = opp.discard.find(c => c.name === '招福达摩');
          
          if (spellCard || darumaCard) {
            akajitaTargets.push({
              playerId: opp.id,
              playerName: opp.name,
              hasSpell: !!spellCard,
              hasDaruma: !!darumaCard,
              spellCard,
              darumaCard
            });
          }
        }
        
        if (akajitaTargets.length === 0) {
          this.addLog(`   ✨ 赤舌：[妨害]对手弃牌堆无符合条件的牌`);
        } else {
          // 处理第一个对手
          const target = akajitaTargets[0];
          const opponent = this.getPlayer(target.playerId);
          if (opponent) {
            if (target.hasSpell && target.hasDaruma) {
              // 两者都有，让对手选择
              const deadline = Date.now() + 5000;
              this.state.pendingChoice = {
                type: 'akajitaSelect',
                playerId: target.playerId,
                triggerPlayerId: player.id,
                prompt: '赤舌：选择1张牌置于牌库顶',
                deadline: deadline,
                options: [
                  { name: '基础术式', cardId: target.spellCard!.cardId },
                  { name: '招福达摩', cardId: target.darumaCard!.cardId }
                ],
                candidates: [
                  { type: 'spell', name: '基础术式', instanceId: target.spellCard!.instanceId },
                  { type: 'daruma', name: '招福达摩', instanceId: target.darumaCard!.instanceId }
                ]
              } as any;
              this.addLog(`   ⏳ 等待 ${target.playerName} 选择置于牌库顶的牌...`);
              this.startAkajitaTimeout(target.playerId);
            } else {
              // 只有一种，自动选中
              const cardToMove = target.spellCard || target.darumaCard;
              if (cardToMove) {
                const idx = opponent.discard.findIndex(c => c.instanceId === cardToMove.instanceId);
                if (idx !== -1) {
                  const card = opponent.discard.splice(idx, 1)[0]!;
                  opponent.deck.unshift(card);
                  (this.state as any).akajitaNotify = (this.state as any).akajitaNotify || [];
                  (this.state as any).akajitaNotify.push({
                    playerId: target.playerId,
                    cardName: card.name,
                    timestamp: Date.now()
                  });
                  this.addLog(`   ✨ ${target.playerName} 的【${card.name}】被置于牌库顶`);
                }
              }
            }
          }
        }
        break;
      }
        
      // ============ 魅妖（选择对手牌库顶牌）============
      case '魅妖': {
        // [妨害] 展示所有对手牌库顶牌，选择1张使用其效果并置入其弃牌堆
        // 完整执行：让轮入道玩家选择，超时时自动AI策略
        const opponents = this.state.players.filter(p => p.id !== player.id);
        const meiYaoCandidates: {
          ownerId: string;
          ownerName: string;
          card: CardInstance;
          instanceId: string;
          usable: boolean;
        }[] = [];
        
        for (const opp of opponents) {
          if (opp.deck.length > 0) {
            const topCard = DeckRevealHelper.revealTopCard(opp, player.id);
            if (topCard) {
              // 令牌和恶评不可用
              const isUsable = topCard.cardType !== 'token' && topCard.cardType !== 'penalty';
              meiYaoCandidates.push({
                ownerId: opp.id,
                ownerName: opp.name,
                card: topCard,
                instanceId: topCard.instanceId,
                usable: isUsable
              });
            }
          }
        }
        
        if (meiYaoCandidates.length === 0) {
          this.addLog(`   ✨ 魅妖：所有对手牌库为空`);
        } else {
          // 检查是否有可用的牌
          const usableCandidates = meiYaoCandidates.filter(c => c.usable);
          if (usableCandidates.length === 0) {
            this.addLog(`   ✨ 魅妖：对手牌库顶牌均不可用（令牌/恶评）`);
          } else {
            // 设置选择
            this.state.pendingChoice = {
              type: 'meiYaoSelect',
              playerId: player.id,
              prompt: '魅妖：选择1张对手牌库顶牌使用其效果',
              candidates: meiYaoCandidates
            } as any;
            this.addLog(`   ⏳ 魅妖：等待选择对手牌库顶牌...`);
          }
        }
        break;
      }
      
      // ============ 镇墓兽（左手边玩家选择禁止退治目标）============
      case '镇墓兽': {
        // 鬼火+1，抓牌+1，伤害+2
        player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
        this.drawCards(player, 1);
        player.damage += 2;
        this.addLog(`   ✨ 镇墓兽：鬼火+1，抓牌+1，伤害+2`);
        
        // 收集所有可选目标（游荡妖怪 + 鬼王）
        const zmsValidTargets: { instanceId: string; name: string; hp: number }[] = [];
        
        // 添加游荡区妖怪
        for (const yokai of this.state.field.yokaiSlots) {
          if (yokai && yokai.instanceId) {
            zmsValidTargets.push({
              instanceId: yokai.instanceId,
              name: yokai.name || '未知妖怪',
              hp: yokai.hp || 0
            });
          }
        }
        
        // 添加鬼王
        if (this.state.field.currentBoss && this.state.field.currentBoss.id) {
          zmsValidTargets.push({
            instanceId: this.state.field.currentBoss.id,
            name: this.state.field.currentBoss.name || '鬼王',
            hp: this.state.field.bossCurrentHp || 0
          });
        }
        
        if (zmsValidTargets.length === 0) {
          this.addLog(`   ⚠️ 镇墓兽：场上没有可选目标`);
        } else {
          // 找到左手边玩家（顺时针下一位）
          const currentPlayerIndex = this.state.players.findIndex(p => p.id === player.id);
          const leftPlayerIndex = (currentPlayerIndex + 1) % this.state.players.length;
          const leftPlayer = this.state.players[leftPlayerIndex];
          
          if (leftPlayer.id === player.id) {
            // 只有自己一个玩家，AI 代选
            const sortedTargets = [...zmsValidTargets].sort((a, b) => a.hp - b.hp);
            const selectedTarget = sortedTargets[0];
            if (!player.prohibitedTargets) {
              player.prohibitedTargets = [];
            }
            player.prohibitedTargets.push(selectedTarget.instanceId);
            this.addLog(`   🚫 镇墓兽：AI 指定 ${selectedTarget.name} 为禁止退治目标`);
          } else if (leftPlayer.isAI || leftPlayer.isOfflineHosted || !leftPlayer.isConnected) {
            // 左手边玩家是 AI 或离线，自动选择 HP 最低的目标
            const sortedTargets = [...zmsValidTargets].sort((a, b) => a.hp - b.hp);
            const selectedTarget = sortedTargets[0];
            if (!player.prohibitedTargets) {
              player.prohibitedTargets = [];
            }
            player.prohibitedTargets.push(selectedTarget.instanceId);
            this.addLog(`   🚫 镇墓兽：${leftPlayer.name} 指定 ${selectedTarget.name} 为禁止退治目标`);
          } else {
            // 设置 pendingChoice，等待左手边玩家选择
            this.state.pendingChoice = {
              type: 'zhenMuShouTarget',
              playerId: leftPlayer.id,
              candidates: zmsValidTargets.map(t => t.instanceId),
              restrictedPlayerId: player.id,
              prompt: `镇墓兽：选择一个目标，本回合 ${player.name} 不能将其退治`
            } as any;
            this.addLog(`   ⏳ 镇墓兽：等待 ${leftPlayer.name} 选择禁止退治目标...`);
          }
        }
        break;
      }
        
      // ============ 其他无交互御魂 ============
      default:
        this.executeYokaiEffectSimple(player, { name: effectKey } as any);
        break;
    }
    
    // 🔑 关键：如果效果执行后没有产生交互(pendingChoice)，需要立即继续轮入道队列
    // 这样可以处理：牌库为空、无目标、自动选择等情况
    if (!this.state.pendingChoice && this.state.wheelMonkQueue) {
      this.checkAndContinueWheelMonkQueue();
    }
  }

  /**
   * 简化版御魂效果执行（用于无交互效果的快速执行）
   * 仅执行数值效果，不触发交互选择
   * @param player 玩家
   * @param card 御魂卡牌
   */
  private executeYokaiEffectSimple(player: PlayerState, card: CardInstance): void {
    const effectKey = card.name || '';
    
    switch (effectKey) {
      case '招福达摩':
        // 无效果
        break;
        
      case '心眼':
        // 伤害+3
        player.damage += 3;
        this.addLog(`   ✨ ${effectKey}：伤害+3`);
        break;
        
      case '涅槃之火':
        // 本回合式神技能鬼火消耗-1
        TempBuffHelper.addBuff(player, { type: 'SKILL_COST_REDUCTION', value: 1, source: '涅槃之火' });
        this.addLog(`   ✨ ${effectKey}：技能消耗-1`);
        break;
        
      case '兵主部':
        // 伤害+2
        player.damage += 2;
        this.addLog(`   ✨ ${effectKey}：伤害+2`);
        break;
        
      case '蝠翼':
        // 抓牌+1，伤害+1
        this.drawCards(player, 1);
        player.damage += 1;
        this.addLog(`   ✨ ${effectKey}：抓牌+1，伤害+1`);
        break;
        
      case '灯笼鬼':
        // 鬼火+1，抓牌+1
        player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
        this.drawCards(player, 1);
        this.addLog(`   ✨ ${effectKey}：鬼火+1，抓牌+1`);
        break;
        
      case '镜姬':
        // 鬼火+1，抓牌+2，伤害+1
        player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
        this.drawCards(player, 2);
        player.damage += 1;
        this.addLog(`   ✨ ${effectKey}：鬼火+1，抓牌+2，伤害+1`);
        break;
        
      case '返魂香': {
        // [妨害] 抓牌+1，伤害+1，每名对手选择：弃置1张手牌或获得1张恶评
        this.drawCards(player, 1);
        player.damage += 1;
        this.addLog(`   ✨ ${effectKey}：抓牌+1，伤害+1`);
        
        // 收集需要选择的对手
        const opponents = this.state.players.filter(p => p.id !== player.id);
        if (opponents.length > 0) {
          // 开始返魂香妨害流程
          this.startFanHunXiangHarassment(player.id, opponents);
        }
        break;
      }
        
      case '铮':
        // 抓牌+1，伤害+2
        this.drawCards(player, 1);
        player.damage += 2;
        this.addLog(`   ✨ ${effectKey}：抓牌+1，伤害+2`);
        break;
        
      case '狂骨': {
        // 抓牌+1，伤害+X（X=打出瞬间鬼火；先于抓牌锁定）
        const dmg = player.ghostFire;
        this.drawCards(player, 1);
        player.damage += dmg;
        this.addLog(`   ✨ ${effectKey}：抓牌+1，伤害+${dmg}`);
        break;
      }
        
      case '雪幽魂': {
        // 抓牌+1
        this.drawCards(player, 1);
        this.addLog(`   ✨ ${effectKey}：抓牌+1`);
        
        // [妨害] 对每名对手执行效果
        for (const opponent of this.state.players) {
          if (opponent.id === player.id) continue;
          
          const penaltyCards = opponent.hand.filter(c => c.cardType === 'penalty');
          
          if (penaltyCards.length > 0) {
            // 有恶评，弃置1张（AI策略：优先弃置农夫）
            const farmer = penaltyCards.find(c => c.cardId === 'penalty_001');
            const cardToDiscard = farmer || penaltyCards[0]!;
            const idx = opponent.hand.findIndex(c => c.instanceId === cardToDiscard.instanceId);
            if (idx !== -1) {
              opponent.discard.push(opponent.hand.splice(idx, 1)[0]!);
              this.addLog(`   🗑️ [妨害] ${opponent.name} 弃置恶评「${cardToDiscard.name}」`);
            }
          } else {
            // 无恶评，获得1张恶评
            this.givePenaltyCard(opponent);
          }
        }
        break;
      }
        
      case '网切':
        // 本回合所有妖怪HP-1，鬼王HP-2（全局 field 级别，覆盖不叠加）
        TempBuffHelper.applyNetCutterToField(this.state.field);
        this.addLog(`   ✨ ${effectKey}：本回合妖怪HP-1，鬼王HP-2`);
        break;
        
      case '针女':
        // 伤害+1，后续技能伤害+2
        player.damage += 1;
        TempBuffHelper.addBuff(player, { type: 'SKILL_DAMAGE_BONUS', value: 2 });
        this.addLog(`   ✨ ${effectKey}：伤害+1，技能伤害+2`);
        break;
        
      default:
        // 其他御魂：只结算基础伤害
        if (card.damage) {
          player.damage += card.damage;
          this.addLog(`   ✨ ${effectKey}：伤害+${card.damage}`);
        }
        break;
    }
  }

  /**
   * 处理树妖弃牌选择响应
   * @param playerId 玩家ID
   * @param selectedId 选择的手牌instanceId
   */
  public handleTreeDemonDiscardResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的树妖弃牌选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'treeDemonDiscard') {
      return { success: false, error: '没有待处理的树妖弃牌选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 从手牌中找到并弃置选中的牌
    const idx = player.hand.findIndex(c => c.instanceId === selectedId);
    if (idx === -1) {
      // 超时/默认：弃置第一张
      if (player.hand.length > 0) {
        const card = player.hand.shift()!;
        this.discard(player, card, 'active');
        this.addLog(`   🗑️ 弃置 ${card.name}（默认）`);
      }
    } else {
      const card = player.hand.splice(idx, 1)[0]!;
      this.discard(player, card, 'active');
      this.addLog(`   🗑️ 弃置 ${card.name}`);
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理薙魂弃牌选择响应
   * @param playerId 玩家ID
   * @param selectedId 选择的手牌instanceId
   */
  public handleNaginataSoulDiscardResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的薙魂弃牌选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'naginataSoulDiscard') {
      return { success: false, error: '没有待处理的薙魂弃牌选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 从手牌中找到并弃置选中的牌
    const idx = player.hand.findIndex(c => c.instanceId === selectedId);
    if (idx === -1) {
      // 超时/默认：弃置第一张
      if (player.hand.length > 0) {
        const card = player.hand.shift()!;
        this.discard(player, card, 'active');
        this.addLog(`   🗑️ 弃置 ${card.name}（默认）`);
      }
    } else {
      const card = player.hand.splice(idx, 1)[0]!;
      this.discard(player, card, 'active');
      this.addLog(`   🗑️ 弃置 ${card.name}`);
    }

    // 检查御魂计数并可能触发鬼火+2
    this.checkNaginataSoulGhostFire(player);

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 检查薙魂御魂计数并触发鬼火+2
   * @param player 玩家
   */
  private checkNaginataSoulGhostFire(player: PlayerState): void {
    // 统计本回合打出的御魂数量（包括薙魂自身）
    const yokaiPlayed = player.played.filter(c => c.cardType === 'yokai').length;
    
    if (yokaiPlayed >= 3) {
      const actualGain = Math.min(2, player.maxGhostFire - player.ghostFire);
      if (actualGain > 0) {
        player.ghostFire += actualGain;
        this.addLog(`   🔥 本回合打出${yokaiPlayed}张御魂，鬼火+${actualGain} (当前: ${player.ghostFire})`);
      } else {
        this.addLog(`   🔥 本回合打出${yokaiPlayed}张御魂（鬼火已满）`);
      }
    } else {
      this.addLog(`   📊 本回合打出${yokaiPlayed}张御魂（需≥3张触发鬼火+2）`);
    }
  }

  /**
   * 处理日女巳时选择响应
   * @param playerId 玩家ID
   * @param choice 选择: 'ghostFire' | 'draw' | 'damage'
   */
  public handleRinyuChoiceResponse(playerId: string, choice: string): { success: boolean; error?: string } {
    // 验证是否有等待的日女巳时选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'rinyuChoice') {
      return { success: false, error: '没有待处理的日女巳时选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 执行选择的效果
    switch (choice) {
      case 'ghostFire':
        player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
        this.addLog(`   🔥 日女巳时：鬼火+1`);
        break;
      case 'draw':
        this.drawCards(player, 2);
        this.addLog(`   🎴 日女巳时：抓牌+2`);
        break;
      case 'damage':
      default:
        player.damage += 2;
        this.addLog(`   ⚔️ 日女巳时：伤害+2`);
        break;
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理蚌精超度手牌选择响应
   * @param playerId 玩家ID
   * @param selectedId 选择的手牌instanceId
   */
  public handleBangJingExileResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的蚌精超度选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'bangJingExile') {
      return { success: false, error: '没有待处理的蚌精超度选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 从手牌中找到并超度选中的牌
    const idx = player.hand.findIndex(c => c.instanceId === selectedId);
    if (idx === -1) {
      // 超时/默认：超度第一张
      if (player.hand.length > 0) {
        const card = player.hand.shift()!;
        player.exiled.push(card);
        this.addLog(`   ☁️ 超度 ${card.name}（默认）`);
      }
    } else {
      const card = player.hand.splice(idx, 1)[0]!;
      player.exiled.push(card);
      this.addLog(`   ☁️ 超度 ${card.name}`);
    }

    // 超度后抓牌+2
    this.drawCards(player, 2);
    this.addLog(`   ✨ 蚌精：抓牌+2`);

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理骰子鬼超度手牌选择响应（第一步）
   * @param playerId 玩家ID
   * @param selectedId 选择的手牌instanceId
   */
  public handleDiceGhostExileResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的骰子鬼超度选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'diceGhostExile') {
      return { success: false, error: '没有待处理的骰子鬼超度选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 从手牌中找到并超度选中的牌
    let exiledCard: CardInstance | undefined;
    const idx = player.hand.findIndex(c => c.instanceId === selectedId);
    if (idx === -1) {
      // 超时/默认：按AI策略选择（声誉最低，同声誉时HP最高）
      if (player.hand.length > 0) {
        const sorted = [...player.hand].sort((a, b) => {
          const charmA = (a as any).charm ?? 0;
          const charmB = (b as any).charm ?? 0;
          if (charmA !== charmB) return charmA - charmB;
          return (b.hp || 0) - (a.hp || 0);
        });
        exiledCard = sorted[0];
        const removeIdx = player.hand.findIndex(c => c.instanceId === exiledCard!.instanceId);
        player.hand.splice(removeIdx, 1);
        player.exiled.push(exiledCard!);
        this.addLog(`   ☁️ 超度 ${exiledCard!.name}（默认）`);
      }
    } else {
      exiledCard = player.hand.splice(idx, 1)[0]!;
      player.exiled.push(exiledCard);
      this.addLog(`   ☁️ 超度 ${exiledCard.name}`);
    }

    // 计算可退治的HP上限
    const maxHp = (exiledCard?.hp || 0) + 2;

    // 查找符合条件的游荡妖怪
    const validTargets = this.state.field.yokaiSlots
      .map((y, i) => ({ yokai: y, index: i }))
      .filter(({ yokai }) => yokai !== null && (yokai.hp || 0) <= maxHp);

    if (validTargets.length === 0) {
      // 没有符合条件的妖怪，结束效果
      this.addLog(`   ✨ 骰子鬼：没有可退治的妖怪（HP≤${maxHp}）`);
      this.state.pendingChoice = undefined;
      
      // 检查是否需要继续轮入道队列
      this.checkAndContinueWheelMonkQueue();
      
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: true };
    }

    // 第二步：选择退治目标
    this.state.pendingChoice = {
      type: 'diceGhostTarget',
      playerId: player.id,
      prompt: `选择1个HP≤${maxHp}的游荡妖怪退治`,
      maxHp: maxHp,
      options: validTargets.map(({ yokai, index }) => ({
        instanceId: yokai!.instanceId,
        cardId: yokai!.cardId,
        name: yokai!.name,
        hp: yokai!.hp ?? 0,
        charm: (yokai as any)?.charm ?? 0,
        slotIndex: index
      }))
    };
    this.addLog(`   ⏳ 等待选择退治目标（HP≤${maxHp}）...`);

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理骰子鬼退治目标选择响应（第二步）
   * @param playerId 玩家ID
   * @param selectedId 选择的妖怪instanceId
   */
  public handleDiceGhostTargetResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    // 验证是否有等待的骰子鬼退治选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'diceGhostTarget') {
      return { success: false, error: '没有待处理的骰子鬼退治选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    const options = (this.state.pendingChoice as any).options || [];

    // 从游荡区找到并退治选中的妖怪
    let targetOption = options.find((o: any) => o.instanceId === selectedId);
    if (!targetOption) {
      // 超时/默认：按AI策略选择（声誉最高，同声誉时HP最高）
      const sorted = [...options].sort((a: any, b: any) => {
        if (a.charm !== b.charm) return b.charm - a.charm;
        return b.hp - a.hp;
      });
      targetOption = sorted[0];
    }

    if (targetOption) {
      const slotIndex = targetOption.slotIndex;
      const yokai = this.state.field.yokaiSlots[slotIndex];
      if (yokai) {
        this.state.field.yokaiSlots[slotIndex] = null;
        player.discard.push(yokai);
        this.addLog(`   ✨ 骰子鬼：退治 ${yokai.name}`);
      }
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 执行魅妖效果：使用对手牌库顶牌的效果并将其置入弃牌区
   * @param player 当前玩家
   * @param target 目标牌信息
   */
  private executeMeiYaoEffect(player: PlayerState, target: { ownerId: string; ownerName: string; card: CardInstance }) {
    const owner = this.getPlayer(target.ownerId);
    if (!owner) return;

    // 从拥有者牌库移除该牌
    const cardIdx = owner.deck.findIndex(c => c.instanceId === target.card.instanceId);
    if (cardIdx === -1) return;
    const card = owner.deck.splice(cardIdx, 1)[0]!;
    
    // 清理展示状态（卡牌离开牌库）
    DeckRevealHelper.removeRevealedCard(owner, card.instanceId);

    this.addLog(`   🎭 使用 ${target.ownerName} 的 ${card.name} 效果`);

    // 执行该牌的效果（视为当前玩家打出）
    // 这里使用简化版本：只执行基础效果，不支持递归选择
    this.executeSimpleCardEffect(player, card);

    // 将该牌置入拥有者的弃牌堆（主动弃置，触发【触】）
    this.discard(owner, card, 'active');
    this.addLog(`   📥 ${card.name} 置入 ${target.ownerName} 弃牌堆`);
  }

  /**
   * 执行简化版卡牌效果（用于魅妖等"使用其效果"场景）
   * 只执行即时效果，不触发交互选择
   */
  private executeSimpleCardEffect(player: PlayerState, card: CardInstance) {
    const cardName = card.name;
    const hp = card.hp ?? 0;

    // 基于卡牌名称执行简化效果
    switch (cardName) {
      // HP1
      case '招福达摩':
        // 令牌不能打出，声誉+1已在charm中
        break;
      
      // HP2
      case '唐纸伞妖':
        player.damage += 1;
        this.addLog(`      → 伤害+1`);
        break;
      case '天邪鬼青':
        player.damage += 1;
        this.addLog(`      → 伤害+1（默认选择）`);
        break;
      case '天邪鬼赤':
        player.damage += 1;
        this.addLog(`      → 伤害+1`);
        break;
      case '天邪鬼黄':
        this.drawCards(player, 2);
        this.addLog(`      → 抓牌+2`);
        break;
      case '天邪鬼绿':
        // 退治效果需要选择，简化跳过
        this.addLog(`      → 效果跳过（需要选择目标）`);
        break;
      case '赤舌':
        // 妨害效果已在对手执行
        break;

      // HP3
      case '灯笼鬼':
        player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
        this.drawCards(player, 1);
        this.addLog(`      → 鬼火+1，抓牌+1`);
        break;
      case '树妖':
        this.drawCards(player, 2);
        this.addLog(`      → 抓牌+2`);
        break;
      case '日女巳时':
        player.damage += 2;
        this.addLog(`      → 伤害+2（默认选择）`);
        break;
      case '蚌精':
        // AI托管：选择价值最低的手牌超度（HP升序，同HP声誉升序）
        if (player.hand.length > 0) {
          const sortedHand = [...player.hand].sort((a, b) => {
            if ((a.hp ?? 0) !== (b.hp ?? 0)) return (a.hp ?? 0) - (b.hp ?? 0);
            return (a.charm ?? 0) - (b.charm ?? 0);
          });
          const cardToExile = sortedHand[0]!;
          const idx = player.hand.findIndex(c => c.instanceId === cardToExile.instanceId);
          if (idx !== -1) {
            const card = player.hand.splice(idx, 1)[0]!;
            player.exiled.push(card);
            this.addLog(`      → 超度 ${card.name}`);
          }
        }
        this.drawCards(player, 2);
        this.addLog(`      → 抓牌+2`);
        break;
      case '鸣屋':
        const dmg = player.discard.length === 0 ? 4 : 2;
        player.damage += dmg;
        this.addLog(`      → 伤害+${dmg}`);
        break;
      case '蝠翼':
        this.drawCards(player, 1);
        player.damage += 1;
        this.addLog(`      → 抓牌+1，伤害+1`);
        break;
      case '兵主部':
        player.damage += 2;
        this.addLog(`      → 伤害+2`);
        break;

      // HP4
      case '骰子鬼':
        // 需要超度+退治，简化跳过
        this.addLog(`      → 效果跳过（需要选择目标）`);
        break;
      case '涅槃之火':
        TempBuffHelper.addBuff(player, { type: 'SKILL_COST_REDUCTION' as any, value: 1 });
        this.addLog(`      → 式神技能费用-1`);
        break;
      case '雪幽魂':
        this.drawCards(player, 1);
        this.addLog(`      → 抓牌+1`);
        break;
      case '网切':
        TempBuffHelper.applyNetCutterToField(this.state.field);
        this.addLog(`      → 本回合妖怪HP-1，鬼王HP-2`);
        break;
      case '铮':
        this.drawCards(player, 1);
        player.damage += 2;
        this.addLog(`      → 抓牌+1，伤害+2`);
        break;
      case '薙魂':
        // 抓牌+1，弃置1张手牌。本回合打出≥3张御魂时鬼火+2
        this.drawCards(player, 1);
        this.addLog(`      → 抓牌+1`);
        // 如果有手牌，让玩家选择要弃置的牌
        if (player.hand.length > 0) {
          this.state.pendingChoice = {
            type: 'naginataSoulDiscard',
            playerId: player.id,
            prompt: '选择1张手牌弃置'
          };
          this.addLog(`      ⏳ 等待选择1张手牌弃置...`);
        } else {
          // 无手牌可弃置时，直接检查御魂计数
          this.checkNaginataSoulGhostFire(player);
        }
        break;
      case '轮入道':
        // 需要选择另一张御魂，简化跳过
        this.addLog(`      → 效果跳过（需要选择另一张御魂）`);
        break;
      case '魍魉之匣':
        // 完整效果（含妨害选择）在 handlePlayCard switch-case 中处理
        // 这里仅执行基础效果（用于轮入道等触发的简化执行）
        this.drawCards(player, 1);
        player.damage += 1;
        this.addLog(`      → 抓牌+1，伤害+1（简化）`);
        break;

      default:
        // 其他卡牌或阴阳术
        if (card.cardType === 'spell') {
          player.damage += (card.damage ?? 1);
          this.addLog(`      → 伤害+${card.damage ?? 1}（阴阳术）`);
        } else {
          this.addLog(`      → 效果未实现`);
        }
        break;
    }
  }

  /**
   * 处理魅妖选择响应
   * @param playerId 玩家ID
   * @param selectedCardId 选中的牌instanceId
   */
  public handleMeiYaoSelectResponse(playerId: string, selectedCardId: string): { success: boolean; error?: string } {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'meiYaoSelect') {
      return { success: false, error: '没有待处理的魅妖选择' };
    }
    if (pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 空选择 = 跳过（无可用牌时）
    if (!selectedCardId) {
      this.addLog(`   ✨ 魅妖：跳过（无可用牌）`);
      this.state.pendingChoice = undefined;
      
      // 检查是否需要继续轮入道队列
      this.checkAndContinueWheelMonkQueue();
      
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: true };
    }

    // 在候选列表中找到选中的牌（用instanceId匹配）
    const candidates = pendingChoice.candidates || [];
    const selected = candidates.find((c: any) => c.instanceId === selectedCardId);
    if (!selected) {
      return { success: false, error: '无效的选择' };
    }
    
    // 检查选中的牌是否可用
    if (selected.usable === false) {
      return { success: false, error: '该牌不可用（令牌/恶评）' };
    }

    // 找到拥有者和该牌
    const owner = this.getPlayer(selected.ownerId);
    if (!owner) return { success: false, error: '牌拥有者不存在' };

    const cardIdx = owner.deck.findIndex(c => c.instanceId === selectedCardId);
    if (cardIdx === -1) return { success: false, error: '牌已不在牌库中' };

    const card = owner.deck[cardIdx];
    this.executeMeiYaoEffect(player, {
      ownerId: selected.ownerId,
      ownerName: selected.ownerName,
      card: card
    });

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  // ============ 镇墓兽效果相关 ============

  /**
   * 处理镇墓兽禁止退治目标选择响应
   * @param playerId 做出选择的玩家ID（左手边玩家）
   * @param targetId 选中的目标 instanceId
   */
  public handleZhenMuShouTargetResponse(playerId: string, targetId: string): { success: boolean; error?: string } {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'zhenMuShouTarget') {
      return { success: false, error: '没有待处理的镇墓兽选择' };
    }
    if (pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    // 验证目标是否合法
    const validCandidates = pendingChoice.candidates || [];
    if (!validCandidates.includes(targetId)) {
      return { success: false, error: '无效的目标选择' };
    }

    // 找到被限制的玩家
    const restrictedPlayer = this.getPlayer(pendingChoice.restrictedPlayerId);
    if (!restrictedPlayer) {
      this.state.pendingChoice = undefined;
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: false, error: '被限制玩家不存在' };
    }

    // 找到目标名称
    let targetName = '未知目标';
    // 先查找游荡妖怪
    const yokai = this.state.field.yokaiSlots.find(y => y?.instanceId === targetId);
    if (yokai) {
      targetName = yokai.name || '妖怪';
    } else if (this.state.field.currentBoss?.id === targetId) {
      // 再查找鬼王
      targetName = this.state.field.currentBoss.name || '鬼王';
    }

    // 记录禁止退治目标
    if (!restrictedPlayer.prohibitedTargets) {
      restrictedPlayer.prohibitedTargets = [];
    }
    restrictedPlayer.prohibitedTargets.push(targetId);

    const chooserPlayer = this.getPlayer(playerId);
    this.addLog(`   🚫 镇墓兽：${chooserPlayer?.name || '玩家'} 指定 ${targetName} 为禁止退治目标`);

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  // ============ 魍魉之匣效果相关 ============

  /**
   * 处理魍魉之匣选择响应
   * @param playerId 做出选择的玩家ID
   * @param targetPlayerId 被选择的目标玩家ID
   * @param action 'keep' 保留 或 'discard' 弃置
   */
  public handleWangliangResponse(
    playerId: string,
    targetPlayerId: string,
    action: 'keep' | 'discard'
  ): { success: boolean; error?: string } {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'wangliangChoice') {
      return { success: false, error: '没有待处理的魍魉之匣选择' };
    }
    if (pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 找到目标玩家
    const target = pendingChoice.allTargets.find((t: any) => t.playerId === targetPlayerId);
    if (!target) {
      return { success: false, error: '无效的目标玩家' };
    }

    // 找到目标玩家实体
    const targetPlayer = this.getPlayer(targetPlayerId);
    if (!targetPlayer) return { success: false, error: '目标玩家不存在' };

    // 执行动作
    if (action === 'discard') {
      // 弃置：从牌库顶移到弃牌堆
      const topCard = targetPlayer.deck.pop();
      if (topCard) {
        targetPlayer.discard.push(topCard);
        this.addLog(`   🗑️ ${targetPlayer.name} 的 ${topCard.name} 被弃置`);
      }
    } else {
      // 保留：不做任何操作
      this.addLog(`   ✅ ${targetPlayer.name} 的 ${target.card.name} 保留在牌库顶`);
    }

    // 记录决策
    pendingChoice.decisions.push({ playerId: targetPlayerId, action });
    pendingChoice.currentIndex++;

    // 检查是否所有目标都处理完毕（只计有牌库的玩家）
    const validCount = pendingChoice.allTargets.filter((t: any) => t.card !== null).length;
    if (pendingChoice.currentIndex >= validCount) {
      // 所有选择完成，清除等待状态
      this.state.pendingChoice = undefined;
      this.addLog(`   ✨ 魍魉之匣妨害效果完成`);
    }

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理魍魉之匣批量选择响应（一次性提交所有决策）
   * @param playerId 做出选择的玩家ID
   * @param decisions 所有决策 { playerId, action }[]
   */
  public handleWangliangBatchResponse(
    playerId: string,
    decisions: { playerId: string; action: 'keep' | 'discard' }[]
  ): { success: boolean; error?: string } {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'wangliangChoice') {
      return { success: false, error: '没有待处理的魍魉之匣选择' };
    }
    if (pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 验证决策数量：只需匹配有牌库的玩家数
    const validTargets = pendingChoice.allTargets.filter((t: any) => t.card !== null);
    if (decisions.length !== validTargets.length) {
      return { success: false, error: `决策数量(${decisions.length})与有牌库玩家数(${validTargets.length})不匹配` };
    }

    // 执行所有决策
    for (const decision of decisions) {
      const targetPlayer = this.getPlayer(decision.playerId);
      if (!targetPlayer) continue;

      const target = pendingChoice.allTargets.find((t: any) => t.playerId === decision.playerId);
      if (!target) continue;

      if (decision.action === 'discard') {
        const topCard = targetPlayer.deck.pop();
        if (topCard) {
          targetPlayer.discard.push(topCard);
          this.addLog(`   🗑️ ${targetPlayer.name} 的 ${topCard.name} 被弃置`);
        }
      } else {
        this.addLog(`   ✅ ${targetPlayer.name} 的 ${target.card.name} 保留在牌库顶`);
      }
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    this.addLog(`   ✨ 魍魉之匣妨害效果完成`);

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  // ============ 赤舌效果相关 ============

  /**
   * 启动赤舌选择超时计时器（5秒）
   */
  private startAkajitaTimeout(playerId: string): void {
    this.clearAkajitaTimeout();
    this.akajitaTimer = setTimeout(() => {
      this.handleAkajitaTimeout(playerId);
    }, 5000);
  }

  /**
   * 清除赤舌超时计时器
   */
  private clearAkajitaTimeout(): void {
    if (this.akajitaTimer) {
      clearTimeout(this.akajitaTimer);
      this.akajitaTimer = undefined;
    }
  }

  /**
   * 赤舌超时处理：默认选择基础术式
   */
  private handleAkajitaTimeout(playerId: string): void {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'akajitaSelect') return;
    if (pendingChoice.playerId !== playerId) return;

    // 默认选择基础术式
    const spellCandidate = pendingChoice.candidates?.find((c: any) => c.type === 'spell');
    if (spellCandidate) {
      this.executeAkajitaSelect(playerId, spellCandidate.instanceId, true);
    } else {
      // fallback: 选择第一个
      const firstCandidate = pendingChoice.candidates?.[0];
      if (firstCandidate) {
        this.executeAkajitaSelect(playerId, firstCandidate.instanceId, true);
      }
    }
  }

  /**
   * 处理赤舌选择响应
   * @param playerId 选择的玩家ID（被妨害的对手）
   * @param selectedId 选中的牌instanceId
   */
  public handleAkajitaSelectResponse(playerId: string, selectedId: string): { success: boolean; error?: string } {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'akajitaSelect') {
      return { success: false, error: '没有待处理的赤舌选择' };
    }
    if (pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    // 验证选择是否有效
    const candidate = pendingChoice.candidates?.find((c: any) => c.instanceId === selectedId);
    if (!candidate) {
      return { success: false, error: '无效的选择' };
    }

    this.clearAkajitaTimeout();
    this.executeAkajitaSelect(playerId, selectedId, false);
    return { success: true };
  }

  /**
   * 执行赤舌选择：将选中的牌从弃牌堆移到牌库顶
   */
  private executeAkajitaSelect(playerId: string, selectedId: string, isTimeout: boolean): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const pendingChoice = this.state.pendingChoice as any;
    const candidate = pendingChoice?.candidates?.find((c: any) => c.instanceId === selectedId);

    // 从弃牌堆找到该牌
    const idx = player.discard.findIndex(c => c.instanceId === selectedId);
    if (idx !== -1) {
      const card = player.discard.splice(idx, 1)[0]!;
      player.deck.unshift(card); // 置于牌库顶

      const timeoutHint = isTimeout ? '（超时默认）' : '';
      this.addLog(`   ✨ ${player.name} 选择将【${card.name}】置于牌库顶${timeoutHint}`);

      // 设置通知（用于客户端显示提示）
      (this.state as any).akajitaNotify = (this.state as any).akajitaNotify || [];
      (this.state as any).akajitaNotify.push({
        playerId: playerId,
        cardName: card.name,
        timestamp: Date.now()
      });
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    // 检查是否需要继续轮入道队列（赤舌是对手选择，但也可能在轮入道场景触发）
    this.checkAndContinueWheelMonkQueue();

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
  }

  /**
   * 强制关闭指定玩家的赤舌选择（用于回合开始时、回合结束时）
   * 如果该玩家有pending的赤舌选择，自动选择基础术式
   */
  private forceCloseAkajitaSelectForPlayer(playerId: string): void {
    const pendingChoice = this.state.pendingChoice as any;
    if (!pendingChoice || pendingChoice.type !== 'akajitaSelect') return;
    if (pendingChoice.playerId !== playerId) return;

    // 清除超时计时器
    this.clearAkajitaTimer();

    // 自动选择基础术式
    const player = this.getPlayer(playerId);
    if (!player) {
      this.state.pendingChoice = undefined;
      return;
    }

    // 找到基础术式
    const spellCard = player.discard.find(c => c.name === '基础术式');
    if (spellCard) {
      const idx = player.discard.findIndex(c => c.instanceId === spellCard.instanceId);
      if (idx !== -1) {
        const card = player.discard.splice(idx, 1)[0]!;
        player.deck.unshift(card); // 置于牌库顶
        this.addLog(`   ✨ ${player.name} 的【${card.name}】被置于牌库顶（回合切换默认）`);

        // 设置通知
        (this.state as any).akajitaNotify = (this.state as any).akajitaNotify || [];
        (this.state as any).akajitaNotify.push({
          playerId: playerId,
          cardName: card.name,
          timestamp: Date.now()
        });
      }
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;
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
    
    // 强制关闭所有玩家的赤舌选择（主回合结束时清理）
    for (const p of this.state.players) {
      this.forceCloseAkajitaSelectForPlayer(p.id);
    }
    
    // 注：妖怪/鬼王HP降为0时已直接退治，无需在此额外处理
    
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
   * 获取玩家当前的技能鬼火消耗减免值（涅槃之火效果）
   * 多个减费buff会叠加
   */
  private getSkillCostReduction(player: PlayerState): number {
    if (!player.tempBuffs || player.tempBuffs.length === 0) return 0;
    
    return player.tempBuffs
      .filter(buff => buff.type === 'SKILL_COST_REDUCTION')
      .reduce((sum, buff) => sum + ((buff as { value: number }).value || 0), 0);
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
    
    this.clearTurnTimer();
    this.clearAfkTimer();
    
    this.onStateChange = undefined;
    this.onInteractRequest = undefined;
    this.onForceExit = undefined;
  }
}