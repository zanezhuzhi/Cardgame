
/**
 * 御魂传说 - 效果执行引擎
 * @file shared/game/effects/EffectEngine.ts
 */

import type {
  Effect,
  EffectContext,
  EffectResult,
  ExecutedEffect,
  EffectCondition,
  DrawEffect,
  GhostFireEffect,
  SpellPowerEffect,
  DamageEffect,
  DiscardEffect,
  AttackBonusEffect,
  ChoiceEffect,
  InterfereEffect
} from './types';

import type { PlayerState, GameState } from '../../types/game';
import type { CardInstance } from '../../types/cards';

/**
 * 效果执行引擎
 */
export class EffectEngine {
  
  /**
   * 执行效果列表
   */
  async executeEffects(
    effects: Effect[],
    context: EffectContext
  ): Promise<EffectResult> {
    const executed: ExecutedEffect[] = [];
    
    for (const effect of effects) {
      // 检查条件
      if (effect.condition && !this.checkCondition(effect.condition, context)) {
        continue;
      }
      
      const result = await this.executeEffect(effect, context);
      executed.push(...result);
    }
    
    return {
      success: true,
      effects: executed
    };
  }
  
  /**
   * 执行单个效果
   */
  private async executeEffect(
    effect: Effect,
    context: EffectContext
  ): Promise<ExecutedEffect[]> {
    switch (effect.type) {
      case 'DRAW':
        return this.executeDraw(effect as DrawEffect, context);
        
      case 'GHOST_FIRE':
        return this.executeGhostFire(effect as GhostFireEffect, context);
        
      case 'SPELL_POWER':
        return this.executeSpellPower(effect as SpellPowerEffect, context);
        
      case 'DAMAGE':
        return this.executeDamage(effect as DamageEffect, context);
        
      case 'DISCARD':
        return this.executeDiscard(effect as DiscardEffect, context);
        
      case 'ATTACK_BONUS':
        return this.executeAttackBonus(effect as AttackBonusEffect, context);
        
      case 'CHOICE':
        return this.executeChoice(effect as ChoiceEffect, context);
        
      case 'INTERFERE':
        return this.executeInterfere(effect as InterfereEffect, context);
        
      default:
        return [{
          type: effect.type,
          description: `未实现的效果: ${effect.type}`
        }];
    }
  }
  
  // ============ 基础效果实现 ============
  
  /**
   * 抓牌效果
   */
  private executeDraw(effect: DrawEffect, context: EffectContext): ExecutedEffect[] {
    const player = context.sourcePlayer;
    const count = effect.value + context.turnDrawBonus;
    
    // 实际抓牌逻辑由GameManager处理
    // 这里只返回描述
    return [{
      type: 'DRAW',
      value: count,
      description: `抓 ${count} 张牌`
    }];
  }
  
  /**
   * 鬼火效果
   */
  private executeGhostFire(effect: GhostFireEffect, context: EffectContext): ExecutedEffect[] {
    const player = context.sourcePlayer;
    const value = effect.value;
    
    // 限制最大值
    const newValue = Math.min(player.ghostFire + value, player.maxGhostFire);
    const actual = newValue - player.ghostFire;
    
    return [{
      type: 'GHOST_FIRE',
      value: actual,
      description: `鬼火 ${actual >= 0 ? '+' : ''}${actual}`
    }];
  }
  
  /**
   * 咒力效果
   */
  private executeSpellPower(effect: SpellPowerEffect, context: EffectContext): ExecutedEffect[] {
    return [{
      type: 'SPELL_POWER',
      value: effect.value,
      description: `咒力 +${effect.value}`
    }];
  }
  
  /**
   * 伤害效果
   */
  private executeDamage(effect: DamageEffect, context: EffectContext): ExecutedEffect[] {
    const damage = effect.value + context.turnDamageBonus;
    
    const result: ExecutedEffect = {
      type: 'DAMAGE',
      value: damage,
      description: `造成 ${damage} 点伤害`
    };
    
    if (effect.targetId) {
      result.targetId = effect.targetId;
    }
    
    return [result];
  }
  
  /**
   * 弃置效果
   */
  private executeDiscard(effect: DiscardEffect, context: EffectContext): ExecutedEffect[] {
    return [{
      type: 'DISCARD',
      value: effect.value,
      description: `弃置 ${effect.value} 张牌`
    }];
  }
  
  /**
   * 伤害加成效果
   */
  private executeAttackBonus(effect: AttackBonusEffect, context: EffectContext): ExecutedEffect[] {
    context.turnDamageBonus += effect.value;
    
    return [{
      type: 'ATTACK_BONUS',
      value: effect.value,
      description: `伤害 +${effect.value}`
    }];
  }
  
  /**
   * 选择效果
   */
  private async executeChoice(effect: ChoiceEffect, context: EffectContext): Promise<ExecutedEffect[]> {
    if (!context.onChoice) {
      // 没有选择回调，默认选第一个
      const firstOption = effect.options[0];
      if (firstOption) {
        const result = await this.executeEffects(firstOption.effects, context);
        return result.effects;
      }
      return [];
    }
    
    const labels = effect.options.map(o => o.label);
    const choice = await context.onChoice(labels);
    const selected = effect.options[choice];
    
    if (selected) {
      const result = await this.executeEffects(selected.effects, context);
      return result.effects;
    }
    
    return [];
  }
  
  /**
   * 妨害效果
   */
  private async executeInterfere(effect: InterfereEffect, context: EffectContext): Promise<ExecutedEffect[]> {
    const results: ExecutedEffect[] = [];
    const { gameState, sourcePlayer } = context;
    
    // 获取目标玩家
    const targetPlayers = gameState.players.filter(p => {
      if (effect.target === 'OTHER_PLAYERS') {
        return p.id !== sourcePlayer.id;
      }
      return true;
    });
    
    // 对每个目标执行效果
    for (const target of targetPlayers) {
      const targetContext: EffectContext = {
        ...context,
        targetPlayer: target
      };
      
      const result = await this.executeEffects(effect.subEffects, targetContext);
      results.push(...result.effects.map(e => ({
        ...e,
        description: `[${target.name}] ${e.description}`
      })));
    }
    
    return results;
  }
  
  // ============ 条件检查 ============
  
  /**
   * 检查条件是否满足
   */
  checkCondition(condition: EffectCondition, context: EffectContext): boolean {
    const actualValue = this.getConditionValue(condition.type, context);
    const expectedValue = condition.value;
    
    switch (condition.operator) {
      case '>': return actualValue > expectedValue;
      case '<': return actualValue < expectedValue;
      case '=': return actualValue === expectedValue;
      case '>=': return actualValue >= expectedValue;
      case '<=': return actualValue <= expectedValue;
      case '!=': return actualValue !== expectedValue;
      default: return false;
    }
  }
  
  /**
   * 获取条件值
   */
  private getConditionValue(type: EffectCondition['type'], context: EffectContext): number | string {
    const player = context.sourcePlayer;
    
    switch (type) {
      case 'HAND_COUNT':
        return player.hand.length;
      case 'DECK_COUNT':
        return player.deck.length;
      case 'DISCARD_COUNT':
        return player.discard.length;
      case 'GHOST_FIRE':
        return player.ghostFire;
      case 'SPELL_POWER':
        return player.spellPower;
      case 'CARDS_PLAYED':
        return player.cardsPlayed;
      case 'SHIKIGAMI_COUNT':
        return player.shikigami.length;
      case 'FIRST_ATTACK':
        return context.isFirstAttack ? 1 : 0;
      case 'TARGET_HP':
        return context.targetCard?.hp ?? 0;
      case 'ALWAYS':
        return 1;
      default:
        return 0;
    }
  }
}

// 导出单例
export const effectEngine = new EffectEngine();
