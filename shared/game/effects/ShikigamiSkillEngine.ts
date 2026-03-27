/**
 * 御魂传说 - 式神技能统一执行引擎
 * @file shared/game/effects/ShikigamiSkillEngine.ts
 * @version 1.0
 *
 * 替代旧的三套并行实现：
 * - ShikigamiEffects.ts (声明式 CardEffectDef)
 * - ShikigamiSkills.ts (命令式 registerSkill)
 * - GameManager.resolveSkillEffect() (switch-case)
 *
 * 设计文档: docs/design/shikigami-framework.md
 */

import type { PlayerState } from '../../types/game';
import type { ShikigamiCard } from '../../types/cards';
import type {
  ShikigamiSkillDef,
  SkillContext,
  SkillResult,
  SkillEvent,
  SkillEventType,
  SkillEventListener,
} from '../../types/shikigami';
import { MARKER_SCHEMAS } from '../../types/shikigami';

// ============ 引擎类 ============

export class ShikigamiSkillEngine {

  /** 技能注册表 { skillId → SkillDef } */
  private readonly registry = new Map<string, ShikigamiSkillDef>();

  /** 按 shikigamiId 索引 { shikigamiId → skillId[] } */
  private readonly shikigamiIndex = new Map<string, string[]>();

  /** 事件总线：{ eventType → Set<listener> } */
  private readonly eventListeners = new Map<SkillEventType, Set<SkillEventListener>>();

  // ════════════════════════════════════════════════════════════
  //  注册
  // ════════════════════════════════════════════════════════════

  /**
   * 注册技能定义（游戏启动时调用）
   * @throws 如果 skillId 重复则抛出错误
   */
  registerSkillDef(def: ShikigamiSkillDef): void {
    if (this.registry.has(def.skillId)) {
      throw new Error(`[ShikigamiSkillEngine] 重复注册 skillId: ${def.skillId}`);
    }
    this.registry.set(def.skillId, def);

    // 维护 shikigamiId → skillId[] 索引
    const list = this.shikigamiIndex.get(def.shikigamiId) ?? [];
    list.push(def.skillId);
    this.shikigamiIndex.set(def.shikigamiId, list);
  }

  /**
   * 批量注册技能
   */
  registerAll(defs: ShikigamiSkillDef[]): void {
    for (const def of defs) {
      this.registerSkillDef(def);
    }
  }

  /**
   * 根据 shikigamiId 获取该式神的所有技能定义
   */
  getSkillDefs(shikigamiId: string): ShikigamiSkillDef[] {
    const ids = this.shikigamiIndex.get(shikigamiId) ?? [];
    return ids.map(id => this.registry.get(id)!).filter(Boolean);
  }

  /**
   * 根据 skillId 获取单个技能定义
   */
  getSkillDef(skillId: string): ShikigamiSkillDef | undefined {
    return this.registry.get(skillId);
  }

  /**
   * 获取该式神的所有【启】主动技能
   */
  getActiveSkills(shikigamiId: string): ShikigamiSkillDef[] {
    return this.getSkillDefs(shikigamiId).filter(d => d.trigger === 'ACTIVE');
  }

  /**
   * 获取该式神的所有被动/触发技能（非 ACTIVE）
   */
  getPassiveSkills(shikigamiId: string): ShikigamiSkillDef[] {
    return this.getSkillDefs(shikigamiId).filter(d => d.trigger !== 'ACTIVE');
  }

  /**
   * 检查引擎是否已注册了指定式神的技能
   */
  hasSkillDefs(shikigamiId: string): boolean {
    return (this.shikigamiIndex.get(shikigamiId)?.length ?? 0) > 0;
  }

  /** 获取已注册的技能总数 */
  get registeredCount(): number {
    return this.registry.size;
  }

  // ════════════════════════════════════════════════════════════
  //  前置校验
  // ════════════════════════════════════════════════════════════

  /**
   * 检查技能是否可发动
   *
   * 统一检查链：
   * 1. skillId 是否存在
   * 2. 式神是否已行动（isExhausted） — 仅【启】需要
   * 3. 本回合使用次数是否达上限
   * 4. 基础鬼火是否足够（固定消耗类型）
   * 5. 技能自身的 canUse() 校验
   *
   * @returns null = 可发动；string = 不可发动原因
   */
  canUseSkill(skillId: string, ctx: SkillContext): string | null {
    const def = this.registry.get(skillId);
    if (!def) {
      return `未知技能: ${skillId}`;
    }

    // 【启】主动技能：检查疲劳
    if (def.trigger === 'ACTIVE') {
      if (ctx.shikigamiState.isExhausted) {
        return '式神本回合已行动';
      }
    }

    // 本回合使用次数限制
    if (def.usesPerTurn > 0) {
      const used = ctx.shikigamiState.skillUsesThisTurn[skillId] ?? 0;
      if (used >= def.usesPerTurn) {
        return `${def.name} 本回合已使用 ${used} 次（上限 ${def.usesPerTurn}）`;
      }
    }

    // 鬼火检查（考虑涅槃之火减费）
    const costReduction = this.getSkillCostReduction(ctx.player);
    if (def.cost.kind === 'GHOST_FIRE') {
      const actualCost = Math.max(0, def.cost.amount - costReduction);
      if (ctx.player.ghostFire < actualCost) {
        return `鬼火不足（需要 ${actualCost}，当前 ${ctx.player.ghostFire}）`;
      }
    } else if (def.cost.kind === 'GHOST_FIRE_VARIABLE') {
      // 可变消耗技能：最低消耗也享受减费
      const actualMin = Math.max(0, def.cost.min - costReduction);
      if (ctx.player.ghostFire < actualMin) {
        return `鬼火不足（至少需要 ${actualMin}，当前 ${ctx.player.ghostFire}）`;
      }
    } else if (def.cost.kind === 'GHOST_FIRE_OPTIONAL') {
      const actualBase = Math.max(0, def.cost.base - costReduction);
      if (ctx.player.ghostFire < actualBase) {
        return `鬼火不足（需要 ${actualBase}，当前 ${ctx.player.ghostFire}）`;
      }
    }

    // 技能自身的前置校验
    return def.canUse(ctx);
  }

  // ════════════════════════════════════════════════════════════
  //  执行主动技能
  // ════════════════════════════════════════════════════════════

  /**
   * 执行主动技能（【启】）
   *
   * 调用链：
   * 1. canUseSkill() 前置校验
   * 2. 扣除鬼火（固定消耗类型由引擎统一扣除）
   * 3. def.execute() 执行技能逻辑
   * 4. 标记 isExhausted（如果 execute 成功）
   * 5. 更新技能使用计数
   */
  async executeActiveSkill(
    skillId: string,
    ctx: SkillContext
  ): Promise<SkillResult> {
    // 1. 前置校验
    const error = this.canUseSkill(skillId, ctx);
    if (error) {
      return { success: false, message: error };
    }

    const def = this.registry.get(skillId)!;
    let ghostFirePaid = 0;

    // 2. 扣除固定鬼火消耗（考虑涅槃之火减费）
    if (def.cost.kind === 'GHOST_FIRE') {
      const costReduction = this.getSkillCostReduction(ctx.player);
      const actualCost = Math.max(0, def.cost.amount - costReduction);
      ctx.player.ghostFire -= actualCost;
      ghostFirePaid = actualCost;
      // 日志提示减费效果
      if (costReduction > 0 && def.cost.amount > 0) {
        ctx.addLog(`   🔥 涅槃之火减费: ${def.cost.amount} → ${actualCost}`);
      }
    }
    // 注意：可变鬼火/可选追加/弃牌消耗由 execute 内部自行处理

    // 3. 执行技能逻辑
    const result = await def.execute(ctx);

    if (result.success) {
      // 4. 标记疲劳
      ctx.shikigamiState.isExhausted = true;

      // 5. 更新使用计数
      const uses = ctx.shikigamiState.skillUsesThisTurn;
      uses[skillId] = (uses[skillId] ?? 0) + 1;

      // 补充 ghostFirePaid（execute 可能自行支付了额外鬼火）
      if (result.ghostFirePaid !== undefined) {
        result.ghostFirePaid += ghostFirePaid;
      } else {
        result.ghostFirePaid = ghostFirePaid;
      }

      // 日志
      ctx.addLog(`⚡ ${ctx.player.name} 的 ${ctx.shikigami.name} 发动【${def.effectType}】${def.name}`);
    } else {
      // 执行失败：退还已扣除的鬼火
      if (ghostFirePaid > 0) {
        ctx.player.ghostFire += ghostFirePaid;
      }
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════
  //  触发被动技能
  // ════════════════════════════════════════════════════════════

  /**
   * 触发被动技能（【触】/【自】/【永】）
   *
   * 由 EventBus 的事件监听器调用。
   * 与 executeActiveSkill 不同的是：
   * - 不检查 isExhausted
   * - 不标记 isExhausted
   * - 仍检查 canUse 和使用次数
   */
  async triggerPassiveSkill(
    skillId: string,
    event: SkillEvent,
    ctx: SkillContext
  ): Promise<SkillResult | null> {
    const def = this.registry.get(skillId);
    if (!def) return null;

    // 使用次数检查
    if (def.usesPerTurn > 0) {
      const used = ctx.shikigamiState.skillUsesThisTurn[skillId] ?? 0;
      if (used >= def.usesPerTurn) return null;
    }

    // 触发时鬼火检查（花鸟卷【自】需要鬼火-1、巫蛊师【触】需要鬼火-1）
    if (def.cost.kind === 'GHOST_FIRE' && def.cost.amount > 0) {
      if (ctx.player.ghostFire < def.cost.amount) return null;
    }

    // 技能自身前置校验
    const error = def.canUse(ctx);
    if (error) return null;

    // 扣除鬼火（如果有消耗）
    let ghostFirePaid = 0;
    if (def.cost.kind === 'GHOST_FIRE' && def.cost.amount > 0) {
      ctx.player.ghostFire -= def.cost.amount;
      ghostFirePaid = def.cost.amount;
    }

    // 执行
    const result = await def.execute(ctx);

    if (result.success) {
      // 更新使用计数
      const uses = ctx.shikigamiState.skillUsesThisTurn;
      uses[skillId] = (uses[skillId] ?? 0) + 1;

      if (ghostFirePaid > 0) {
        result.ghostFirePaid = (result.ghostFirePaid ?? 0) + ghostFirePaid;
      }

      ctx.addLog(`🔮 ${ctx.player.name} 的 ${ctx.shikigami.name} 触发【${def.effectType}】${def.name}`);
    } else if (ghostFirePaid > 0) {
      // 执行失败退还鬼火
      ctx.player.ghostFire += ghostFirePaid;
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════
  //  事件总线
  // ════════════════════════════════════════════════════════════

  /**
   * 注册事件监听器
   */
  on(eventType: SkillEventType, listener: SkillEventListener): void {
    let set = this.eventListeners.get(eventType);
    if (!set) {
      set = new Set();
      this.eventListeners.set(eventType, set);
    }
    set.add(listener);
  }

  /**
   * 移除事件监听器
   */
  off(eventType: SkillEventType, listener: SkillEventListener): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  /**
   * 触发事件（依次执行所有监听器，await 每个）
   */
  async emit(event: SkillEvent, ctx: SkillContext): Promise<void> {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      await listener(event, ctx);
    }
  }

  /**
   * 清空所有事件监听器
   */
  clearListeners(): void {
    this.eventListeners.clear();
  }

  // ════════════════════════════════════════════════════════════
  //  生命周期钩子
  // ════════════════════════════════════════════════════════════

  /**
   * 回合开始：重置式神状态
   *
   * - 重置 isExhausted
   * - 重置 skillUsesThisTurn
   * - 清理 clearOn='TURN_START' 的指示物（食梦貘沉睡）
   * - 清理 clearOn='TURN_END' 遗漏的指示物
   */
  onTurnStart(player: PlayerState): void {
    for (const state of player.shikigamiState) {
      // 重置疲劳
      state.isExhausted = false;

      // 重置技能使用计数
      state.skillUsesThisTurn = {};

      // 清理 TURN_START 时机的指示物
      this.clearMarkersOnTiming(state, 'TURN_START');

      // 兜底清理上回合遗留的 TURN_END 指示物
      this.clearMarkersOnTiming(state, 'TURN_END');
    }
  }

  /**
   * 回合结束：清理回合内状态
   *
   * - 清理 clearOn='TURN_END' 的指示物
   */
  onTurnEnd(player: PlayerState): void {
    for (const state of player.shikigamiState) {
      this.clearMarkersOnTiming(state, 'TURN_END');
    }
  }

  /**
   * 式神入场：注册事件监听器
   *
   * 遍历该式神的所有非 ACTIVE 技能，根据 trigger 注册对应事件监听。
   */
  onShikigamiEnter(
    player: PlayerState,
    shikigami: ShikigamiCard,
    buildContext: (player: PlayerState, shikigamiId: string) => SkillContext
  ): void {
    const defs = this.getPassiveSkills(shikigami.id);

    for (const def of defs) {
      const eventType = this.triggerToEventType(def.trigger);
      if (!eventType) continue;

      const listener: SkillEventListener = async (event, _ctx) => {
        // 构建最新的 context
        const ctx = buildContext(player, shikigami.id);
        await this.triggerPassiveSkill(def.skillId, event, ctx);
      };

      // 存储 listener 引用以便后续移除
      this.storeListener(shikigami.id, player.id, eventType, listener);
      this.on(eventType, listener);
    }
  }

  /**
   * 式神离场：移除事件监听器
   */
  onShikigamiLeave(player: PlayerState, shikigamiId: string): void {
    const key = `${shikigamiId}:${player.id}`;
    const storedListeners = this.listenerStore.get(key);
    if (!storedListeners) return;

    for (const [eventType, listener] of storedListeners) {
      this.off(eventType, listener);
    }
    this.listenerStore.delete(key);
  }

  // ════════════════════════════════════════════════════════════
  //  工具方法
  // ════════════════════════════════════════════════════════════

  /**
   * 创建默认的 ShikigamiState
   */
  static createDefaultState(cardId: string): import('../../types/game').ShikigamiState {
    return {
      cardId,
      isExhausted: false,
      markers: {},
      skillUsesThisTurn: {},
      statusFlags: [],
    };
  }

  /**
   * 清理指定时机的指示物
   */
  private clearMarkersOnTiming(
    state: import('../../types/game').ShikigamiState,
    timing: 'TURN_START' | 'TURN_END'
  ): void {
    for (const key of Object.keys(state.markers)) {
      const schema = MARKER_SCHEMAS[key];
      if (schema && schema.clearOn === timing) {
        delete state.markers[key];
      }
    }
  }

  /**
   * SkillTriggerType → SkillEventType 映射
   */
  private triggerToEventType(trigger: string): SkillEventType | null {
    switch (trigger) {
      case 'ON_TURN_START':  return 'TURN_START';
      case 'ON_DRAW':        return 'CARDS_DRAWN';
      case 'ON_EXILE':       return 'CARD_EXILED';
      case 'ON_INTERFERE':   return 'HARASSMENT_INCOMING';
      case 'ON_FIRST_HARASS': return 'HARASSMENT_INITIATED';
      case 'ON_KILL':        return 'YOKAI_KILLED';
      case 'ON_DAMAGE':      return 'DAMAGE_DEALT';
      case 'PASSIVE':        return 'TURN_END'; // 永久被动在回合结束时检查
      default:               return null;
    }
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

  // ── 监听器存储（用于 onShikigamiLeave 时移除） ──

  /** { `shikigamiId:playerId` → [eventType, listener][] } */
  private readonly listenerStore = new Map<string, Array<[SkillEventType, SkillEventListener]>>();

  private storeListener(
    shikigamiId: string,
    playerId: string,
    eventType: SkillEventType,
    listener: SkillEventListener
  ): void {
    const key = `${shikigamiId}:${playerId}`;
    const list = this.listenerStore.get(key) ?? [];
    list.push([eventType, listener]);
    this.listenerStore.set(key, list);
  }

  // ════════════════════════════════════════════════════════════
  //  重置
  // ════════════════════════════════════════════════════════════

  /**
   * 完全重置引擎（新游戏时调用）
   */
  reset(): void {
    this.clearListeners();
    this.listenerStore.clear();
    // 注意：不清空 registry 和 shikigamiIndex，技能定义是全局的
  }
}

// ════════════════════════════════════════════════════════════
//  全局单例（可选）
// ════════════════════════════════════════════════════════════

/** 全局技能引擎实例 */
export const globalSkillEngine = new ShikigamiSkillEngine();
