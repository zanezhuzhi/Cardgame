/**
 * 本地游戏适配器
 * 包装 SinglePlayerGame，用于单人模式
 */

import type { IGameAdapter, ActionResult, GameAction } from './IGameAdapter'
import type { GameState, CardInstance } from '../types/game'
import { SinglePlayerGame } from './SinglePlayerGame'

export class LocalAdapter implements IGameAdapter {
  private game: SinglePlayerGame | null = null
  private _state: GameState | null = null
  private stateCallback: ((state: GameState) => void) | null = null
  private playerName: string
  
  constructor(playerName: string = '玩家') {
    this.playerName = playerName
  }
  
  // ========== 状态 ==========
  get state(): GameState | null {
    return this._state
  }
  
  get isReady(): boolean {
    return this.game !== null
  }
  
  get myPlayerIndex(): number {
    return 0 // 单人模式始终是第一个玩家
  }
  
  // ========== 生命周期 ==========
  async init(): Promise<void> {
    this.game = new SinglePlayerGame(this.playerName, (state) => {
      this._state = state
      this.stateCallback?.(state)
    })
    this._state = this.game.getState()
  }
  
  destroy(): void {
    this.game = null
    this._state = null
  }
  
  onStateChange(callback: (state: GameState) => void): void {
    this.stateCallback = callback
  }
  
  // ========== 式神选择阶段 ==========
  async selectShikigami(shikigamiId: string): Promise<ActionResult> {
    if (!this.game) return { success: false, error: '游戏未初始化' }
    try {
      this.game.selectShikigami(shikigamiId)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  async deselectShikigami(shikigamiId: string): Promise<ActionResult> {
    if (!this.game) return { success: false, error: '游戏未初始化' }
    try {
      this.game.deselectShikigami(shikigamiId)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  async confirmShikigamiSelection(): Promise<ActionResult> {
    if (!this.game) return { success: false, error: '游戏未初始化' }
    try {
      this.game.confirmShikigamiSelection()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  // ========== 游戏动作 ==========
  async sendAction(action: GameAction): Promise<ActionResult> {
    if (!this.game) return { success: false, error: '游戏未初始化' }
    
    try {
      switch (action.type) {
        case 'playCard':
          await this.game.playCard(action.cardInstanceId)
          return { success: true }
          
        case 'useShikigamiSkill':
          await this.game.useShikigamiSkill(action.shikigamiId, action.targetId)
          return { success: true }
          
        case 'allocateDamage':
          await this.game.allocateDamage(action.slotIndex)
          return { success: true }
          
        case 'attackBoss':
          this.game.attackBoss(action.damage)
          return { success: true }
          
        case 'endTurn':
          await this.game.endTurn()
          return { success: true }
          
        case 'retireYokai':
          await this.game.retireYokai(action.slotIndex)
          return { success: true }
          
        case 'banishYokai':
          this.game.banishYokai(action.slotIndex)
          return { success: true }
          
        case 'decideYokaiRefresh':
          this.game.decideYokaiRefresh(action.refresh)
          return { success: true }
          
        case 'confirmShikigamiPhase':
          this.game.confirmShikigamiPhase()
          return { success: true }
          
        case 'selectShikigami':
          this.game.selectShikigami(action.shikigamiId)
          return { success: true }
          
        case 'deselectShikigami':
          this.game.deselectShikigami(action.shikigamiId)
          return { success: true }
          
        case 'confirmShikigamiSelection':
          this.game.confirmShikigamiSelection()
          return { success: true }
          
        default:
          return { success: false, error: `未知动作类型: ${(action as any).type}` }
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  // ========== 便捷方法 ==========
  async playCard(cardInstanceId: string): Promise<ActionResult> {
    return this.sendAction({ type: 'playCard', cardInstanceId })
  }
  
  async useShikigamiSkill(shikigamiId: string, targetId?: string): Promise<ActionResult> {
    return this.sendAction({ type: 'useShikigamiSkill', shikigamiId, targetId })
  }
  
  async allocateDamage(slotIndex: number): Promise<ActionResult> {
    return this.sendAction({ type: 'allocateDamage', slotIndex })
  }
  
  async attackBoss(damage: number): Promise<ActionResult> {
    return this.sendAction({ type: 'attackBoss', damage })
  }
  
  async endTurn(): Promise<ActionResult> {
    return this.sendAction({ type: 'endTurn' })
  }
  
  async retireYokai(slotIndex: number): Promise<ActionResult> {
    return this.sendAction({ type: 'retireYokai', slotIndex })
  }
  
  async banishYokai(slotIndex: number): Promise<ActionResult> {
    return this.sendAction({ type: 'banishYokai', slotIndex })
  }
  
  async decideYokaiRefresh(refresh: boolean): Promise<ActionResult> {
    return this.sendAction({ type: 'decideYokaiRefresh', refresh })
  }
  
  async confirmShikigamiPhase(): Promise<ActionResult> {
    return this.sendAction({ type: 'confirmShikigamiPhase' })
  }
  
  // ========== UI 交互回调 ==========
  setChoiceCallback(callback: (options: string[]) => Promise<number>): void {
    if (this.game) {
      this.game.onChoiceRequired = callback
    }
  }
  
  setTargetCallback(callback: (candidates: CardInstance[]) => Promise<string>): void {
    if (this.game) {
      this.game.onSelectTargetRequired = callback
    }
  }
  
  setCardsCallback(callback: (candidates: CardInstance[], count: number) => Promise<string[]>): void {
    if (this.game) {
      this.game.onSelectCardsRequired = callback
    }
  }
  
  // ========== 单人模式特有方法（直接暴露游戏实例的方法）==========
  
  /** 获取游戏实例（用于单人模式特有操作） */
  getGame(): SinglePlayerGame | null {
    return this.game
  }
  
  /** 检查卡牌是否可打出 */
  canPlayCard(card: CardInstance): { canPlay: boolean; reason?: string } {
    if (!this.game) return { canPlay: false, reason: '游戏未初始化' }
    return this.game.canPlayCard(card)
  }
  
  /** 获取当前累积伤害 */
  getCurrentDamage(): number {
    return this.game?.getCurrentDamage() ?? 0
  }
  
  /** 检查是否可获得基础术式 */
  canGainBasicSpell(): boolean {
    return this.game?.canGainBasicSpell() ?? false
  }
  
  /** 获得基础术式 */
  gainBasicSpell(): boolean {
    return this.game?.gainBasicSpell() ?? false
  }
  
  /** 检查是否可兑换中级符咒 */
  canExchangeMediumSpell(): boolean {
    return this.game?.canExchangeMediumSpell() ?? false
  }
  
  /** 检查是否可兑换高级符咒 */
  canExchangeAdvancedSpell(): boolean {
    return this.game?.canExchangeAdvancedSpell() ?? false
  }
  
  /** 检查是否可获取式神 */
  canAcquireShikigami(): boolean {
    return this.game?.canAcquireShikigami() ?? false
  }
  
  /** 检查是否可置换式神 */
  canReplaceShikigami(): boolean {
    return this.game?.canReplaceShikigami() ?? false
  }
  
  /** 获取手牌阴阳术伤害 */
  getSpellDamageInHand(): number {
    return this.game?.getSpellDamageInHand() ?? 0
  }
  
  /** 检查手牌是否有高级符咒 */
  hasAdvancedSpellInHand(): boolean {
    return this.game?.hasAdvancedSpellInHand() ?? false
  }
  
  /** 获取手牌中的阴阳术 */
  getSpellCardsInHand(): CardInstance[] {
    return this.game?.getSpellCardsInHand() ?? []
  }
}
