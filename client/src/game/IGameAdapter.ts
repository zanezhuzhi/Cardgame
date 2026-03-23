/**
 * 游戏适配器接口
 * 统一单人/多人模式的游戏操作接口
 */

import type { GameState, CardInstance } from '../types/game'

// 定义简化的 GameAction 类型（适配器层使用）
export type GameAction = 
  | { type: 'playCard'; cardInstanceId: string }
  | { type: 'useShikigamiSkill'; shikigamiId: string; targetId?: string }
  | { type: 'allocateDamage'; slotIndex: number }
  | { type: 'attackBoss'; damage: number }
  | { type: 'endTurn' }
  | { type: 'retireYokai'; slotIndex: number }
  | { type: 'banishYokai'; slotIndex: number }
  | { type: 'decideYokaiRefresh'; refresh: boolean }
  | { type: 'confirmShikigamiPhase' }
  | { type: 'selectShikigami'; shikigamiId: string }
  | { type: 'deselectShikigami'; shikigamiId: string }
  | { type: 'confirmShikigamiSelection' }

/** 动作结果 */
export interface ActionResult {
  success: boolean
  error?: string
}

/** 游戏适配器接口 */
export interface IGameAdapter {
  // ========== 状态 ==========
  /** 获取当前游戏状态 */
  readonly state: GameState | null
  
  /** 是否已连接/初始化 */
  readonly isReady: boolean
  
  /** 当前玩家索引 */
  readonly myPlayerIndex: number
  
  // ========== 生命周期 ==========
  /** 初始化 */
  init(): Promise<void>
  
  /** 销毁 */
  destroy(): void
  
  /** 设置状态变更回调 */
  onStateChange(callback: (state: GameState) => void): void
  
  // ========== 式神选择阶段 ==========
  /** 选择式神 */
  selectShikigami(shikigamiId: string): Promise<ActionResult>
  
  /** 取消选择式神 */
  deselectShikigami(shikigamiId: string): Promise<ActionResult>
  
  /** 确认式神选择 */
  confirmShikigamiSelection(): Promise<ActionResult>
  
  // ========== 游戏动作 ==========
  /** 发送游戏动作 */
  sendAction(action: GameAction): Promise<ActionResult>
  
  // ========== 便捷方法（可选实现）==========
  /** 打出卡牌 */
  playCard?(cardInstanceId: string): Promise<ActionResult>
  
  /** 使用式神技能 */
  useShikigamiSkill?(shikigamiId: string, targetId?: string): Promise<ActionResult>
  
  /** 分配伤害 */
  allocateDamage?(slotIndex: number): Promise<ActionResult>
  
  /** 攻击鬼王 */
  attackBoss?(damage: number): Promise<ActionResult>
  
  /** 结束回合 */
  endTurn?(): Promise<ActionResult>
  
  /** 退治妖怪 */
  retireYokai?(slotIndex: number): Promise<ActionResult>
  
  /** 超度妖怪 */
  banishYokai?(slotIndex: number): Promise<ActionResult>
  
  /** 决定是否刷新妖怪 */
  decideYokaiRefresh?(refresh: boolean): Promise<ActionResult>
  
  /** 确认式神阶段 */
  confirmShikigamiPhase?(): Promise<ActionResult>
  
  // ========== UI 交互回调 ==========
  /** 设置选择回调（用于御魂效果等需要玩家选择的场景） */
  setChoiceCallback?(callback: (options: string[]) => Promise<number>): void
  
  /** 设置目标选择回调 */
  setTargetCallback?(callback: (candidates: CardInstance[]) => Promise<string>): void
  
  /** 设置卡牌选择回调 */
  setCardsCallback?(callback: (candidates: CardInstance[], count: number) => Promise<string[]>): void
}
