/**
 * 《御魂传说》游戏核心类型定义
 */

// ============ 卡牌类型 ============

/** 卡牌大类 */
export type CardCategory = 
  | 'onmyoji'      // 阴阳师
  | 'shikigami'    // 式神
  | 'boss'         // 鬼王
  | 'spell'        // 阴阳术
  | 'penalty'      // 惩令
  | 'yokai'        // 游荡妖怪

/** 式神稀有度 */
export type Rarity = 'R' | 'SR' | 'SSR'

/** 式神定位 */
export type ShikigamiRole = 
  | 'output'    // 输出
  | 'combo'     // 连击
  | 'support'   // 辅助
  | 'control'   // 控制

/** 卡牌基础属性 */
export interface CardBase {
  id: string
  name: string
  category: CardCategory
  description: string
  imageUrl?: string
}

/** 阴阳师卡 */
export interface OnmyojiCard extends CardBase {
  category: 'onmyoji'
}

/** 式神卡 */
export interface ShikigamiCard extends CardBase {
  category: 'shikigami'
  rarity: Rarity
  role: ShikigamiRole
  skillCost: number      // 技能消耗鬼火
  charmValue: number     // 符咒值 (R:3, SR:4, SSR:5)
  skills: ShikigamiSkill[]
}

/** 式神技能 */
export interface ShikigamiSkill {
  name: string
  cost: number           // 鬼火消耗
  description: string
  effect: CardEffect[]
  usesPerTurn?: number   // 每回合使用次数，默认1
}

/** 鬼王卡 */
export interface BossCard extends CardBase {
  category: 'boss'
  health: number         // 生命值
  charmValue: number     // 符咒值
  onAppear?: CardEffect[] // 登场效果
}

/** 阴阳术卡 */
export interface SpellCard extends CardBase {
  category: 'spell'
  subType: 'basic' | 'charm_fragment' | 'advanced'
  spellPower?: number    // 咒力
  charmValue?: number    // 符咒值
  effects: CardEffect[]
  isPersistent?: boolean // 是否持续类
}

/** 惩令卡 */
export interface PenaltyCard extends CardBase {
  category: 'penalty'
  penaltyType: 'farmer' | 'warrior'  // 农夫/武士
  charmValue: number     // 负的符咒值
}

/** 游荡妖怪卡（御魂） */
export interface YokaiCard extends CardBase {
  category: 'yokai'
  health: number         // 生命值
  charmValue: number     // 符咒值
  effects: CardEffect[]
}

/** 所有卡牌联合类型 */
export type Card = 
  | OnmyojiCard 
  | ShikigamiCard 
  | BossCard 
  | SpellCard 
  | PenaltyCard 
  | YokaiCard

// ============ 卡牌效果 ============

/** 效果类型 */
export type EffectType =
  | 'draw'           // 抓牌
  | 'spell_power'    // 咒力
  | 'ghost_fire'     // 鬼火
  | 'damage'         // 伤害
  | 'charm'          // 符咒
  | 'discard'        // 弃置
  | 'exile'          // 超度
  | 'reveal'         // 展示
  | 'obtain'         // 获得
  | 'retire'         // 退治
  | 'summon'         // 召唤式神
  | 'custom'         // 自定义效果

/** 目标类型 */
export type TargetType =
  | 'self'           // 自己
  | 'opponent'       // 对手
  | 'all_opponents'  // 所有对手
  | 'field_yokai'    // 场上妖怪
  | 'field_boss'     // 场上鬼王
  | 'deck_top'       // 牌库顶
  | 'discard_pile'   // 弃牌堆
  | 'hand'           // 手牌

/** 卡牌效果 */
export interface CardEffect {
  type: EffectType
  value?: number
  target?: TargetType
  condition?: string   // 触发条件描述
  description?: string
}

// ============ 玩家状态 ============

export interface PlayerState {
  id: string
  name: string
  onmyoji: OnmyojiCard | null
  shikigamis: ShikigamiCard[]   // 最多3个
  
  // 资源
  ghostFire: number      // 鬼火 (0-5)
  spellPower: number     // 当前累积咒力
  totalCharm: number     // 累计符咒
  
  // 牌区
  deck: Card[]           // 牌库
  hand: Card[]           // 手牌
  discardPile: Card[]    // 弃牌堆
  playedCards: Card[]    // 本回合打出的牌
  
  // 状态
  isActive: boolean      // 是否当前回合
  hasAllocatedDamage: boolean  // 是否已分配伤害
}

// ============ 游戏状态 ============

export type GamePhase = 
  | 'setup'          // 准备阶段
  | 'action'         // 行动阶段
  | 'cleanup'        // 清理阶段
  | 'ended'          // 游戏结束

export interface FieldState {
  yokaiDisplay: YokaiCard[]    // 展示的游荡妖怪 (最多6张)
  currentBoss: BossCard | null // 当前鬼王
  exileZone: Card[]            // 超度区
}

export interface GameState {
  roomId: string
  phase: GamePhase
  currentPlayerIndex: number
  turnNumber: number
  
  players: PlayerState[]
  field: FieldState
  
  // 牌堆
  yokaiDeck: YokaiCard[]       // 游荡妖怪牌堆
  bossDeck: BossCard[]         // 鬼王牌堆
  shikigamiDeck: ShikigamiCard[] // 式神召唤牌堆
  spellShop: SpellCard[]       // 阴阳术商店
  penaltyDeck: PenaltyCard[]   // 惩令牌堆
  
  // 游戏结束
  isEnded: boolean
  winner: string | null
}

// ============ 游戏动作 ============

export type GameActionType =
  | 'play_card'        // 打出卡牌
  | 'use_skill'        // 使用式神技能
  | 'allocate_damage'  // 分配伤害
  | 'summon_shikigami' // 召唤式神
  | 'swap_shikigami'   // 置换式神
  | 'end_action'       // 结束行动阶段
  | 'select_target'    // 选择目标

export interface GameAction {
  type: GameActionType
  playerId: string
  payload: {
    cardId?: string
    skillIndex?: number
    targetIds?: string[]
    damageAllocation?: { targetId: string; damage: number }[]
  }
}

// ============ 网络事件 ============

export interface ServerToClientEvents {
  'game:state': (state: GameState) => void
  'game:action_result': (result: { success: boolean; message?: string }) => void
  'game:ended': (result: { winner: PlayerState; rankings: PlayerState[] }) => void
  'player:joined': (player: { id: string; name: string }) => void
  'player:left': (playerId: string) => void
}

export interface ClientToServerEvents {
  'game:action': (action: GameAction) => void
  'game:ready': () => void
  'room:create': (name: string, callback: (roomId: string) => void) => void
  'room:join': (roomId: string, callback: (success: boolean) => void) => void
  'room:leave': () => void
}