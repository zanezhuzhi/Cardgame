/**
 * 游戏适配器模块
 * 导出所有适配器和接口
 */

export type { IGameAdapter, ActionResult } from './IGameAdapter'
export { LocalAdapter } from './LocalAdapter'
export { RemoteAdapter } from './RemoteAdapter'

import type { IGameAdapter } from './IGameAdapter'
import { LocalAdapter } from './LocalAdapter'
import { RemoteAdapter } from './RemoteAdapter'

/**
 * 创建游戏适配器
 * @param mode - 'local' 单人模式，'remote' 多人模式
 * @param playerName - 玩家名称（单人模式使用）
 */
export function createGameAdapter(mode: 'local' | 'remote', playerName?: string): IGameAdapter {
  if (mode === 'local') {
    return new LocalAdapter(playerName || '玩家')
  } else {
    return new RemoteAdapter()
  }
}
