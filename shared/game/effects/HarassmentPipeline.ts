/**
 * HarassmentPipeline — 妨害效果统一解算管线
 *
 * 职责：
 *   1. 遍历所有目标玩家
 *   2. 对每个目标依次检查抵抗链
 *   3. 只有未被完全免疫时，才调用 applyToTarget 执行妨害
 *   4. 如果发起者拥有丑时之女，在首次妨害成功时触发奖励
 *
 * 抵抗链优先级（高→低）：
 *   ① 手牌防御 — 青女房（展示，不消耗）/ 铮（弃置+抓牌+2）
 *   ② 式神被动 — 萤草（移除种子 → 完全免疫）
 *   ③ 式神被动 — 花鸟卷（鬼火-1 → 抓牌+2+置顶 → 仍受妨害）
 *   ④ 式神被动 — 食梦貘（沉睡中弃1牌 → 仍受妨害）
 *
 * 设计要点：
 *   - 与 ShikigamiSkillEngine 解耦：管线只依赖 PlayerState / SkillContext
 *   - 策略模式：每种抵抗能力以 ResistHandler 注册，方便未来扩展
 *   - 日志驱动：所有抵抗/免疫都产生日志供前端播放
 */

import type { PlayerState } from '../../types/game';
import type { CardInstance } from '../../types/cards';
import type {
  SkillContext,
  HarassmentAction,
  HarassmentResistResult,
} from '../../types/shikigami';

// ============ 抵抗处理器 ============

/**
 * 单个抵抗能力的处理器
 */
export interface ResistHandler {
  /** 处理器唯一标识 */
  id: string;
  /** 优先级（数字越小越先执行） */
  priority: number;
  /**
   * 判断是否拥有此抵抗能力
   * @param target 受妨害的目标玩家
   * @param ctx 技能上下文
   * @returns true 表示拥有此能力
   */
  canResist: (target: PlayerState, ctx: SkillContext) => boolean;
  /**
   * 执行抵抗
   * @param target 受妨害的目标玩家
   * @param ctx 技能上下文
   * @returns immune = true 表示完全免疫（后续不再执行妨害）
   */
  resolve: (target: PlayerState, ctx: SkillContext) => Promise<HarassmentResistResult>;
}

/** 全局抵抗处理器注册表 */
const resistHandlers: ResistHandler[] = [];

/**
 * 注册一个抵抗处理器
 * 按 priority 升序自动排序
 */
export function registerResistHandler(handler: ResistHandler): void {
  resistHandlers.push(handler);
  resistHandlers.sort((a, b) => a.priority - b.priority);
}

/**
 * 清空所有抵抗处理器（测试用）
 */
export function clearResistHandlers(): void {
  resistHandlers.length = 0;
}

/**
 * 获取当前注册的处理器列表（只读，测试用）
 */
export function getResistHandlers(): readonly ResistHandler[] {
  return resistHandlers;
}

// ============ 核心管线 ============

/**
 * 单目标妨害抵抗结果
 */
export interface TargetHarassmentResult {
  targetId: string;
  targetName: string;
  /** 是否被完全免疫 */
  immune: boolean;
  /** 免疫来源（如 '青女房' / '萤草种子'） */
  immuneSource?: string;
  /** 抵抗前置效果日志 */
  preEffectLogs: string[];
  /** 妨害是否成功执行 */
  applied: boolean;
}

/**
 * 整体妨害结果
 */
export interface HarassmentPipelineResult {
  /** 每个目标的结算结果 */
  targets: TargetHarassmentResult[];
  /** 成功被妨害的目标数 */
  affectedCount: number;
  /** 是否为发起者本回合首次妨害（用于丑时之女触发） */
  isFirstHarass: boolean;
  /** 汇总日志 */
  logs: string[];
}

/**
 * 执行妨害管线
 *
 * @param action 妨害动作定义
 * @param targets 受妨害的目标玩家列表（不含发起者自身）
 * @param ctx 技能上下文（发起者的上下文）
 * @returns 管线执行结果
 */
export async function resolveHarassment(
  action: HarassmentAction,
  targets: PlayerState[],
  ctx: SkillContext,
): Promise<HarassmentPipelineResult> {
  const logs: string[] = [];
  const targetResults: TargetHarassmentResult[] = [];

  logs.push(`⚔️ ${action.sourceSkillName}：发起妨害`);

  // ── 逐目标结算 ──
  for (const target of targets) {
    const result = await resolveForSingleTarget(action, target, ctx, logs);
    targetResults.push(result);
  }

  const affectedCount = targetResults.filter(r => r.applied).length;

  // ── 发起者首次妨害检查（丑时之女等触发） ──
  const isFirstHarass = checkFirstHarass(ctx);

  if (isFirstHarass) {
    logs.push(`🎭 ${ctx.player.name}：本回合首次发起妨害`);
    // 发射 HARASSMENT_INITIATED 事件，让丑时之女等被动能监听
    await ctx.emitEvent({
      type: 'HARASSMENT_INITIATED',
      sourcePlayerId: action.sourcePlayerId,
      data: {
        skillName: action.sourceSkillName,
        isFirstHarass: true,
      },
    });
  }

  return {
    targets: targetResults,
    affectedCount,
    isFirstHarass,
    logs,
  };
}

/**
 * 对单个目标执行抵抗链 + 妨害
 */
async function resolveForSingleTarget(
  action: HarassmentAction,
  target: PlayerState,
  ctx: SkillContext,
  logs: string[],
): Promise<TargetHarassmentResult> {
  const result: TargetHarassmentResult = {
    targetId: target.id,
    targetName: target.name,
    immune: false,
    preEffectLogs: [],
    applied: false,
  };

  const prevSubject = ctx.harassmentResistSubject;
  ctx.harassmentResistSubject = target;
  try {
    // 依次执行抵抗链
    for (const handler of resistHandlers) {
      if (!handler.canResist(target, ctx)) continue;

      const resistResult = await handler.resolve(target, ctx);

      // 收集前置效果日志
      result.preEffectLogs.push(...resistResult.preEffectLogs);
      logs.push(...resistResult.preEffectLogs);

      if (resistResult.immune) {
        result.immune = true;
        result.immuneSource = handler.id;
        logs.push(`🛡️ ${target.name}：${handler.id} — 完全免疫妨害`);
        break; // 完全免疫，跳过后续抵抗和妨害执行
      }
      // 非免疫（如花鸟卷/食梦貘）：记录前置效果，继续后续处理
    }

    // 未免疫 → 执行妨害（apply 阶段仍携带 subject，便于回调识别「当前受影响玩家」）
    if (!result.immune) {
      await action.applyToTarget(target, ctx);
      result.applied = true;
      logs.push(`💥 ${target.name}：受到 ${action.sourceSkillName} 妨害`);
    }

    return result;
  } finally {
    ctx.harassmentResistSubject = prevSubject;
  }
}

// ============ 首次妨害追踪 ============

/**
 * 检查是否为发起者本回合首次妨害
 * 使用 tempBuffs 中的标记追踪
 */
function checkFirstHarass(ctx: SkillContext): boolean {
  const player = ctx.player;
  const marker = player.tempBuffs.find(b => (b as any).type === 'HARASS_COUNT');

  if (!marker) {
    // 首次 → 添加标记
    player.tempBuffs.push({
      type: 'HARASS_COUNT' as any,
      value: 1,
      duration: 1,
      source: 'harassmentPipeline',
    } as any);
    return true;
  }

  // 已有标记 → 非首次
  (marker as any).value += 1;
  return false;
}

// ============ 内建抵抗处理器 ============

/**
 * 工具函数：在目标玩家的 shikigamiState 中查找指定式神
 * @returns [slotIndex, ShikigamiState] 或 null
 */
function findShikigami(
  player: PlayerState,
  cardId: string,
): { slotIndex: number; cardId: string } | null {
  const idx = player.shikigamiState.findIndex(s => s.cardId === cardId);
  if (idx === -1) return null;
  return { slotIndex: idx, cardId };
}

/**
 * 工具函数：在手牌中查找指定 cardId 的卡牌
 */
function findHandCard(
  player: PlayerState,
  cardId: string,
): CardInstance | undefined {
  return player.hand.find(c => c.cardId === cardId);
}

// ── P10: 青女房（展示免疫，可选） ──
registerResistHandler({
  id: '青女房',
  priority: 10,
  canResist(target) {
    // 手牌中有青女房
    return !!findHandCard(target, 'yokai_037');
  },
  async resolve(target, ctx) {
    const card = findHandCard(target, 'yokai_037')!;

    // 青女房：展示即可，不消耗
    // 询问目标玩家是否展示青女房来免疫妨害
    // onChoice 由服务端注入：对目标玩家发起选择交互
    // 若无回调（测试/离线）默认选择展示（索引 0）
    let choice = 0; // 默认展示
    try {
      choice = await ctx.onChoice(
        ['展示「青女房」（免疫妨害）', '不展示'],
        `${target.name} 受到妨害，是否展示「青女房」来免疫？`,
      );
    } catch {
      // 回调异常时使用默认策略（展示）
      choice = 0;
    }

    if (choice !== 0) {
      // 玩家选择不展示 → 不免疫，继续后续抵抗链
      return {
        immune: false,
        preEffectLogs: [`🃏 ${target.name} 选择不展示「青女房」`],
      };
    }

    // 展示青女房 → 免疫（牌保留在手牌中）
    ctx.addLog(`🛡️ ${target.name} 展示「${card.name}」，免疫妨害`);

    return {
      immune: true,
      preEffectLogs: [`🛡️ ${target.name} 展示「${card.name}」，免疫妨害`],
    };
  },
});

// ── P20: 铮（可选弃置+抓牌+2，免疫） ──
registerResistHandler({
  id: '铮',
  priority: 20,
  canResist(target) {
    return !!findHandCard(target, 'yokai_021');
  },
  async resolve(target, ctx) {
    const card = findHandCard(target, 'yokai_021')!;

    // 询问目标玩家是否弃置「铮」来抵消妨害
    // onChoice 由服务端注入：对目标玩家发起选择交互
    // 若无回调（测试/离线）默认选择弃置（索引 0）
    let choice = 0; // 默认弃置
    try {
      choice = await ctx.onChoice(
        ['弃置「铮」（抓牌+2，免疫妨害）', '不弃置'],
        `${target.name} 受到妨害，是否弃置「铮」来抵消？`,
      );
    } catch {
      // 回调异常时使用默认策略（弃置）
      choice = 0;
    }

    if (choice !== 0) {
      // 玩家选择不弃置 → 不免疫，继续后续抵抗链
      return {
        immune: false,
        preEffectLogs: [`🃏 ${target.name} 选择不弃置「铮」`],
      };
    }

    // 弃置铮 → 抓牌+2 → 免疫
    const cardIdx = target.hand.findIndex(c => c.instanceId === card.instanceId);
    if (cardIdx !== -1) {
      const discarded = target.hand.splice(cardIdx, 1)[0]!;
      target.discard.push(discarded);
    }

    // 抓牌+2
    ctx.drawCards(target, 2);

    ctx.addLog(`🛡️ ${target.name} 弃置「${card.name}」抓牌+2，免疫妨害`);

    return {
      immune: true,
      preEffectLogs: [`🛡️ ${target.name} 弃置「${card.name}」抓牌+2，免疫妨害`],
    };
  },
});

// ── P30: 萤草·种子（移除1枚种子，完全免疫） ──
registerResistHandler({
  id: '萤草种子',
  priority: 30,
  canResist(target) {
    const shiki = findShikigami(target, 'shikigami_014');
    if (!shiki) return false;
    const state = target.shikigamiState[shiki.slotIndex];
    return !!state && ((state.markers['seed'] as number) || 0) > 0;
  },
  async resolve(target, ctx) {
    const shiki = findShikigami(target, 'shikigami_014')!;
    const state = target.shikigamiState[shiki.slotIndex];

    const seeds = (state!.markers['seed'] as number) || 0;
    state!.markers['seed'] = seeds - 1;
    if (state!.markers['seed'] === 0) {
      delete state!.markers['seed'];
    }

    ctx.addLog(`🌱 ${target.name}：萤草移除1枚祝福种子，免疫妨害（剩余${seeds - 1}枚）`);

    return {
      immune: true,
      preEffectLogs: [
        `🌱 ${target.name}：萤草移除1枚祝福种子，免疫妨害（剩余${seeds - 1}枚）`,
      ],
    };
  },
});

// ── P40: 花鸟卷（鬼火-1 → 抓牌+2+置顶1牌 → 不免疫） ──
registerResistHandler({
  id: '花鸟卷',
  priority: 40,
  canResist(target) {
    const shiki = findShikigami(target, 'shikigami_004');
    if (!shiki) return false;
    // 需要鬼火 ≥ 1
    return target.ghostFire >= 1;
  },
  async resolve(target, ctx) {
    // 鬼火-1
    target.ghostFire -= 1;

    // 抓牌+2
    ctx.drawCards(target, 2);

    // 将1张手牌置于牌库顶
    if (target.hand.length > 0) {
      // 需要目标玩家选择哪张手牌置顶
      // 暂用第一张（未来接入交互回调）
      let putBackId: string;
      if (target.hand.length === 1) {
        putBackId = target.hand[0]!.instanceId;
      } else {
        // TODO: 接入目标玩家交互选择
        // 现阶段自动选最后一张（模拟选择）
        putBackId = target.hand[target.hand.length - 1]!.instanceId;
      }

      const idx = target.hand.findIndex(c => c.instanceId === putBackId);
      if (idx !== -1) {
        const card = target.hand.splice(idx, 1)[0]!;
        target.deck.unshift(card);
      }
    }

    ctx.addLog(`📖 ${target.name}：花鸟卷发动 — 鬼火-1，抓牌+2，置顶1张手牌，然后结算妨害`);

    return {
      immune: false, // 花鸟卷不免疫，仍受妨害
      preEffectLogs: [
        `📖 ${target.name}：花鸟卷发动 — 鬼火-1，抓牌+2，置顶1张手牌`,
      ],
    };
  },
});

// ── P50: 食梦貘·沉睡（沉睡状态弃1牌 → 不免疫） ──
registerResistHandler({
  id: '食梦貘沉睡',
  priority: 50,
  canResist(target) {
    // 拥有食梦貘 且 处于沉睡状态
    const shiki = findShikigami(target, 'shikigami_012');
    if (!shiki) return false;
    const state = target.shikigamiState[shiki.slotIndex];
    // 检查沉睡状态（statusFlags 或 tempBuffs）
    const isSleeping =
      state?.statusFlags?.includes('sleep') ||
      target.tempBuffs.some(b => (b as any).source === '沉睡');
    return !!isSleeping;
  },
  async resolve(target, ctx) {
    // 弃置1张手牌
    if (target.hand.length > 0) {
      // 随机弃置（沉睡中无法选择）
      const randomIdx = Math.floor(Math.random() * target.hand.length);
      const discarded = target.hand.splice(randomIdx, 1)[0]!;
      target.discard.push(discarded);

      ctx.addLog(`💤 ${target.name}：食梦貘沉睡中受妨害，弃置「${discarded.name}」`);

      return {
        immune: false, // 仍受妨害
        preEffectLogs: [
          `💤 ${target.name}：食梦貘沉睡中受妨害，弃置「${discarded.name}」`,
        ],
      };
    }

    return {
      immune: false,
      preEffectLogs: [
        `💤 ${target.name}：食梦貘沉睡中受妨害（无手牌可弃）`,
      ],
    };
  },
});

// ============ 便捷工具 ============

/**
 * 构建妨害动作（供式神技能使用）
 *
 * @example
 * ```typescript
 * const action = createHarassmentAction(
 *   ctx.player.id,
 *   '百目鬼',
 *   async (target, ctx) => {
 *     // 强制弃置1张手牌
 *     if (target.hand.length > 0) {
 *       const randomIdx = Math.floor(Math.random() * target.hand.length);
 *       const [card] = target.hand.splice(randomIdx, 1);
 *       target.discard.push(card);
 *     }
 *   }
 * );
 * const result = await resolveHarassment(action, ctx.opponents, ctx);
 * ```
 */
export function createHarassmentAction(
  sourcePlayerId: string,
  sourceSkillName: string,
  applyToTarget: (target: PlayerState, ctx: SkillContext) => Promise<void>,
): HarassmentAction {
  return {
    sourcePlayerId,
    sourceSkillName,
    applyToTarget,
  };
}
