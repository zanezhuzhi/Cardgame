/**
 * 御魂传说 - 效果执行引擎 v2
 * @file shared/game/effects/EffectEngine.ts
 *
 * 职责：接收 CardEffect[] + EffectContext，直接修改 PlayerState/GameState
 */

import type {
  CardEffect, AtomEffect, ChoiceEffect, ConditionalEffect,
  EffectContext, EffectCondition,
  DrawEffect, GhostFireEffect, DamageEffect, DiscardEffect,
  ExileHandEffect, GainSpellEffect, GainPenaltyEffect,
  MarkerAddEffect, MarkerRemoveEffect, KillYokaiEffect,
  InterfereEffect, TempBuffEffect, ReduceHpEffect,
  RecoverFromDiscardEffect, GainShikigamiEffect,
  PutTopEffect, PutBottomEffect, RevealTopEffect,
  SkipCleanupEffect, HealYokaiEffect, TempBuffType,
} from './types';

import type { CardInstance } from '../../types/cards';
import type { PlayerState } from '../../types/game';
import { shuffle } from '../../data/loader';

export class EffectEngine {

  // ============ 主入口 ============

  async execute(effects: CardEffect[], ctx: EffectContext): Promise<void> {
    for (const effect of effects) {
      await this.executeOne(effect, ctx);
    }
  }

  private async executeOne(effect: CardEffect, ctx: EffectContext): Promise<void> {
    if (effect.type === 'CHOICE') {
      return this.executeChoice(effect as ChoiceEffect, ctx);
    }
    if (effect.type === 'CONDITIONAL') {
      return this.executeConditional(effect as ConditionalEffect, ctx);
    }
    return this.executeAtom(effect as AtomEffect, ctx);
  }

  // ============ 原子效果 ============

  private async executeAtom(effect: AtomEffect, ctx: EffectContext): Promise<void> {
    const { player, gameState } = ctx;

    switch (effect.type) {

      case 'DRAW': {
        this.drawCards(player, effect.count);
        break;
      }

      case 'GHOST_FIRE': {
        player.ghostFire = Math.max(0,
          Math.min(player.ghostFire + effect.value, player.maxGhostFire)
        );
        break;
      }

      case 'DAMAGE': {
        player.damage += effect.value;
        break;
      }

      case 'DISCARD': {
        const target = effect.target ?? 'SELF';
        const targets = this.resolvePlayers(target, player, gameState);
        for (const p of targets) {
          if (effect.random) {
            // 随机弃指定数量
            for (let i = 0; i < effect.count && p.hand.length > 0; i++) {
              const idx = Math.floor(Math.random() * p.hand.length);
              const card = p.hand.splice(idx, 1)[0]!;
              p.discard.push(card);
            }
          } else {
            // 玩家自选（需要回调）
            if (ctx.onSelectCards && p === player) {
              const ids = await ctx.onSelectCards(p.hand, effect.count);
              for (const id of ids) {
                const idx = p.hand.findIndex(c => c.instanceId === id);
                if (idx !== -1) {
                  p.discard.push(p.hand.splice(idx, 1)[0]!);
                }
              }
            } else {
              // fallback: 随机弃（AI 或无回调场景）
              for (let i = 0; i < effect.count && p.hand.length > 0; i++) {
                const idx = Math.floor(Math.random() * p.hand.length);
                p.discard.push(p.hand.splice(idx, 1)[0]!);
              }
            }
          }
        }
        break;
      }

      case 'EXILE_HAND': {
        if (ctx.onSelectCards) {
          const ids = await ctx.onSelectCards(player.hand, effect.count);
          for (const id of ids) {
            const idx = player.hand.findIndex(c => c.instanceId === id);
            if (idx !== -1) {
              player.exiled.push(player.hand.splice(idx, 1)[0]!);
            }
          }
        } else {
          // fallback: 超度第一张
          for (let i = 0; i < effect.count && player.hand.length > 0; i++) {
            player.exiled.push(player.hand.splice(0, 1)[0]!);
          }
        }
        break;
      }

      case 'GAIN_SPELL': {
        const tierMap = { basic: '基础术式', medium: '中级符咒', advanced: '高级符咒' };
        const spellName = tierMap[effect.tier];
        const supply = gameState.field.spellSupply;
        const key = effect.tier;
        if (supply[key] && gameState.field.spellCounts[key] > 0) {
          const template = supply[key]!;
          player.discard.push({
            instanceId: `spell_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            cardId: template.cardId,
            cardType: 'spell',
            name: spellName,
            hp: template.hp,
            maxHp: template.maxHp,
            damage: template.damage,
            charm: template.charm ?? 0,
            image: template.image,
          });
          gameState.field.spellCounts[key]--;
        }
        break;
      }

      case 'GAIN_PENALTY': {
        const targets = this.resolvePlayers(effect.target, player, gameState);
        for (const p of targets) {
          const pile = gameState.field.penaltyPile;
          const penalty = pile.find(c =>
            (effect.penaltyType === 'farmer' && c.name === '农夫') ||
            (effect.penaltyType === 'warrior' && c.name === '武士')
          );
          if (penalty) {
            pile.splice(pile.indexOf(penalty), 1);
            p.discard.push({ ...penalty, instanceId: `pen_${Date.now()}` });
          }
        }
        break;
      }

      case 'MARKER_ADD': {
        const state = ctx.player.shikigamiState[0]; // 触发的式神状态由调用者指定
        if (state) {
          const cur = (state.markers[effect.markerKey] as number) || 0;
          const max = effect.max ?? Infinity;
          state.markers[effect.markerKey] = Math.min(cur + effect.count, max);
        }
        break;
      }

      case 'MARKER_REMOVE': {
        const state = ctx.player.shikigamiState[0];
        if (state) {
          if (effect.count === 'ALL') {
            delete state.markers[effect.markerKey];
          } else {
            const cur = (state.markers[effect.markerKey] as number) || 0;
            const next = cur - effect.count;
            if (next <= 0) delete state.markers[effect.markerKey];
            else state.markers[effect.markerKey] = next;
          }
        }
        break;
      }

      case 'KILL_YOKAI': {
        // 玩家选择一个生命不高于maxHp的妖怪直接退治
        const eligible = gameState.field.yokaiSlots
          .map((c, i) => ({ card: c, idx: i }))
          .filter(({ card }) => card !== null && card.hp <= effect.maxHp);

        if (eligible.length === 0) break;

        let targetIdx: number;
        if (ctx.onSelectTarget) {
          const id = await ctx.onSelectTarget(eligible.map(e => e.card!));
          targetIdx = eligible.find(e => e.card!.instanceId === id)?.idx ?? eligible[0]!.idx;
        } else {
          targetIdx = eligible[0]!.idx;
        }

        const killed = gameState.field.yokaiSlots[targetIdx]!;
        player.discard.push(killed);
        player.totalCharm = [...player.deck, ...player.hand, ...player.discard, ...player.played]
          .reduce((s, c) => s + (c.charm || 0), 0);
        gameState.field.yokaiSlots[targetIdx] = null;
        break;
      }

      case 'INTERFERE': {
        const targets = gameState.players.filter(p =>
          effect.target === 'OTHER_PLAYERS'
            ? p.id !== player.id
            : true
        );
        for (const target of targets) {
          const subCtx: EffectContext = { ...ctx, player: target };
          for (const sub of effect.subEffects) {
            await this.executeAtom(sub, subCtx);
          }
        }
        break;
      }

      case 'TEMP_BUFF': {
        const buff = effect as TempBuffEffect;
        player.tempBuffs.push({
          type: buff.buffType,
          value: buff.value,
          duration: buff.duration ?? 1,
          condition: buff.condition,
          remainingUses: buff.value, // 用于计数型buff
        });
        break;
      }

      case 'REDUCE_HP': {
        const reduceEffect = effect as ReduceHpEffect;
        if (reduceEffect.target === 'YOKAI' || reduceEffect.target === 'ALL') {
          for (const slot of gameState.field.yokaiSlots) {
            if (slot) {
              slot.hp = Math.max(1, slot.hp - reduceEffect.value);
            }
          }
        }
        if (reduceEffect.target === 'BOSS' || reduceEffect.target === 'ALL') {
          if (gameState.field.bossHp > 0) {
            gameState.field.bossHp = Math.max(1, gameState.field.bossHp - reduceEffect.value);
          }
        }
        break;
      }

      case 'RECOVER_FROM_DISCARD': {
        const recoverEffect = effect as RecoverFromDiscardEffect;
        const candidates = player.discard.filter(c => {
          if (recoverEffect.cardType === 'spell') return c.cardType === 'spell';
          if (recoverEffect.cardType === 'yokai') return c.cardType === 'yokai';
          return true;
        });
        
        if (candidates.length > 0 && ctx.onSelectCards) {
          const ids = await ctx.onSelectCards(candidates, Math.min(recoverEffect.count, candidates.length));
          for (const id of ids) {
            const idx = player.discard.findIndex(c => c.instanceId === id);
            if (idx !== -1) {
              player.hand.push(player.discard.splice(idx, 1)[0]!);
            }
          }
        } else {
          // fallback: 取前N张符合条件的
          const toRecover = candidates.slice(0, recoverEffect.count);
          for (const card of toRecover) {
            const idx = player.discard.findIndex(c => c.instanceId === card.instanceId);
            if (idx !== -1) {
              player.hand.push(player.discard.splice(idx, 1)[0]!);
            }
          }
        }
        break;
      }

      case 'PUT_TOP': {
        const putTopEffect = effect as PutTopEffect;
        const count = putTopEffect.count ?? 1;
        if (ctx.onSelectCards && player.hand.length > 0) {
          const ids = await ctx.onSelectCards(player.hand, Math.min(count, player.hand.length));
          for (const id of ids) {
            const idx = player.hand.findIndex(c => c.instanceId === id);
            if (idx !== -1) {
              player.deck.push(player.hand.splice(idx, 1)[0]!);
            }
          }
        }
        break;
      }

      case 'PUT_BOTTOM': {
        const putBottomEffect = effect as PutBottomEffect;
        const count = putBottomEffect.count ?? 1;
        if (ctx.onSelectCards && player.hand.length > 0) {
          const ids = await ctx.onSelectCards(player.hand, Math.min(count, player.hand.length));
          for (const id of ids) {
            const idx = player.hand.findIndex(c => c.instanceId === id);
            if (idx !== -1) {
              player.deck.unshift(player.hand.splice(idx, 1)[0]!);
            }
          }
        }
        break;
      }

      case 'REVEAL_TOP': {
        const revealEffect = effect as RevealTopEffect;
        // 展示效果通常需要UI层处理
        // 这里只做数据准备，标记展示的牌
        const revealed: any[] = [];
        for (let i = 0; i < revealEffect.count && player.deck.length > 0; i++) {
          const card = player.deck[player.deck.length - 1 - i];
          if (card) revealed.push(card);
        }
        // 通过 ctx 传递展示信息
        if (ctx.onSelectTarget && revealEffect.canExile && revealed.length > 0) {
          const id = await ctx.onSelectTarget(revealed);
          const idx = player.deck.findIndex(c => c.instanceId === id);
          if (idx !== -1) {
            player.exiled.push(player.deck.splice(idx, 1)[0]!);
          }
        }
        break;
      }

      case 'SKIP_CLEANUP': {
        // 标记跳过清理阶段
        player.tempBuffs.push({
          type: 'SKIP_CLEANUP' as any,
          value: 1,
          duration: 1,
        });
        break;
      }

      case 'HEAL_YOKAI': {
        const healEffect = effect as HealYokaiEffect;
        for (const slot of gameState.field.yokaiSlots) {
          if (slot) {
            const shouldHeal = !healEffect.maxHp || slot.maxHp <= healEffect.maxHp;
            if (shouldHeal) {
              slot.hp = Math.min(slot.maxHp, slot.hp + healEffect.value);
            }
          }
        }
        break;
      }

      case 'GAIN_SHIKIGAMI': {
        // 获取式神逻辑，需要 GameManager 层面处理
        // 这里只做标记
        if (ctx.sourceCard) {
          const gainEffect = effect as GainShikigamiEffect;
          if (gainEffect.exileThis) {
            // 将触发此效果的卡牌超度
            player.exiled.push(ctx.sourceCard);
          }
        }
        break;
      }
    }
  }

  // ============ 复合效果 ============

  private async executeChoice(effect: ChoiceEffect, ctx: EffectContext): Promise<void> {
    const labels = effect.options.map(o => o.label);
    let chosen = 0;
    if (ctx.onChoice) {
      chosen = await ctx.onChoice(labels);
    }
    const option = effect.options[chosen];
    if (option) {
      await this.execute(option.effects, ctx);
    }
  }

  private async executeConditional(effect: ConditionalEffect, ctx: EffectContext): Promise<void> {
    if (this.checkCondition(effect.condition, ctx)) {
      await this.execute(effect.thenEffects, ctx);
    } else if (effect.elseEffects) {
      await this.execute(effect.elseEffects, ctx);
    }
  }

  // ============ 条件检查 ============

  checkCondition(cond: EffectCondition, ctx: EffectContext): boolean {
    const { player } = ctx;
    let actual: number;

    switch (cond.key) {
      case 'CARDS_PLAYED_THIS_TURN':
        actual = player.cardsPlayed; break;
      case 'YOKAI_PLAYED_THIS_TURN':
        actual = player.played.filter(c => c.cardType === 'yokai').length; break;
      case 'SPELL_PLAYED_THIS_TURN':
        actual = player.played.filter(c => c.cardType === 'spell').length; break;
      case 'DISCARD_EMPTY':
        actual = player.discard.length === 0 ? 1 : 0; break;
      case 'HAND_COUNT':
        actual = player.hand.length; break;
      case 'GHOST_FIRE':
        actual = player.ghostFire; break;
      case 'MARKER_COUNT': {
        const state = player.shikigamiState[0];
        actual = (state?.markers[cond.markerKey ?? ''] as number) || 0;
        break;
      }
      case 'IS_FIRST_CARD':
        actual = player.cardsPlayed === 1 ? 1 : 0; break;
      default:
        actual = 0;
    }

    switch (cond.op) {
      case '>':  return actual > cond.value;
      case '<':  return actual < cond.value;
      case '=':  return actual === cond.value;
      case '>=': return actual >= cond.value;
      case '<=': return actual <= cond.value;
      case '!=': return actual !== cond.value;
      default:   return false;
    }
  }

  // ============ 工具方法 ============

  private drawCards(player: PlayerState, count: number): void {
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      const card = player.deck.pop();
      if (card) player.hand.push(card);
    }
  }

  private resolvePlayers(
    target: 'SELF' | 'OTHER_PLAYERS' | 'ALL_PLAYERS',
    self: PlayerState,
    gameState: { players: PlayerState[] }
  ): PlayerState[] {
    switch (target) {
      case 'SELF':          return [self];
      case 'OTHER_PLAYERS': return gameState.players.filter(p => p.id !== self.id);
      case 'ALL_PLAYERS':   return gameState.players;
    }
  }
}

export const effectEngine = new EffectEngine();