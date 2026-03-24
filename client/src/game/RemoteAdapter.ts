/**
 * 远程游戏适配器
 * 包装 SocketClient，用于多人模式
 */

import type { IGameAdapter, ActionResult, GameAction } from './IGameAdapter'
import type { GameState, CardInstance } from '../types/game'
import { socketClient } from '../network/SocketClient'

export class RemoteAdapter implements IGameAdapter {
  private _state: GameState | null = null
  private stateCallback: ((state: GameState) => void) | null = null
  
  constructor() {}
  
  // ========== 状态 ==========
  get state(): GameState | null {
    return socketClient.gameState || this._state
  }
  
  get isReady(): boolean {
    return socketClient.isConnected && socketClient.gameState !== null
  }
  
  get myPlayerIndex(): number {
    // 从 socketClient 获取玩家索引
    const state = this.state
    if (!state) return -1
    const myId = socketClient.playerId
    return state.players.findIndex(p => p.id === myId)
  }
  
  // ========== 生命周期 ==========
  async init(): Promise<void> {
    // SocketClient 已经在 App.vue 中初始化
    // 这里只需要注册状态变更监听
    socketClient.on('gameEvent', (event: any) => {
      if (event.type === 'STATE_UPDATE' || event.type === 'GAME_STARTED') {
        this._state = event.state
        this.stateCallback?.(event.state)
      }
    })
    
    // 如果已有游戏状态，立即回调
    if (socketClient.gameState) {
      this._state = socketClient.gameState
      this.stateCallback?.(socketClient.gameState)
    }
  }
  
  destroy(): void {
    // 清理监听（如果需要）
    this._state = null
  }
  
  onStateChange(callback: (state: GameState) => void): void {
    this.stateCallback = callback
  }
  
  // ========== 式神选择阶段 ==========
  async selectShikigami(shikigamiId: string): Promise<ActionResult> {
    try {
      await socketClient.sendAction({ type: 'selectShikigami', shikigamiId })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  async deselectShikigami(shikigamiId: string): Promise<ActionResult> {
    try {
      await socketClient.sendAction({ type: 'deselectShikigami', shikigamiId })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  async confirmShikigamiSelection(): Promise<ActionResult> {
    try {
      await socketClient.sendAction({ type: 'confirmShikigamiSelection' })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
  
  // ========== 游戏动作 ==========
  async sendAction(action: GameAction): Promise<ActionResult> {
    try {
      await socketClient.sendAction(action)
      return { success: true }
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
  
  // ========== UI 交互回调（多人模式暂不支持）==========
  setChoiceCallback(_callback: (options: string[]) => Promise<number>): void {
    // TODO: 多人模式需要通过 Socket 实现交互请求
    console.warn('[RemoteAdapter] setChoiceCallback 暂不支持')
  }
  
  setTargetCallback(_callback: (candidates: CardInstance[]) => Promise<string>): void {
    console.warn('[RemoteAdapter] setTargetCallback 暂不支持')
  }
  
  setCardsCallback(_callback: (candidates: CardInstance[], count: number) => Promise<string[]>): void {
    console.warn('[RemoteAdapter] setCardsCallback 暂不支持')
  }
}
