/**
 * 御魂传说 - 式神技能定义注册表
 * @file shared/game/effects/ShikigamiSkillDefs.ts
 *
 * 将 MultiplayerGame.executeShikigamiSkill() 中的 switch-case
 * 迁移为 ShikigamiSkillDef 格式，统一注册到 ShikigamiSkillEngine。
 *
 * 每个 SkillDef 包含：前置校验(canUse) + 执行逻辑(execute)
 * 引擎负责：鬼火扣除 → execute → 标记疲劳 → 使用计数
 */

import type { ShikigamiSkillDef, SkillContext, SkillResult } from '../../types/shikigami';

// ============ 已迁移的式神定义 ============

/**
 * shikigami_022 — 山童「怪力」
 * 【启】鬼火-1：本回合前2张阴阳术+1伤害
 */
const yamawaro: ShikigamiSkillDef = {
  skillId: 'shikigami_022:怪力',
  shikigamiId: 'shikigami_022',
  name: '怪力',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 1 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '本回合打出的前2张阴阳术+1伤害',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    // 添加 SPELL_DAMAGE_BONUS buff
    ctx.player.tempBuffs.push({
      type: 'SPELL_DAMAGE_BONUS',
      bonusPerSpell: 1,
      remainingCount: 2,
      sourceSkill: '怪力',
    } as any);
    return { success: true, message: '本回合前2张阴阳术+1伤害' };
  },
};

/**
 * shikigami_004 — 茨木童子「迁怒」
 * 【启】鬼火-1：本回合每退治/超度妖怪+2伤害
 */
const ibarakiDouji: ShikigamiSkillDef = {
  skillId: 'shikigami_004:迁怒',
  shikigamiId: 'shikigami_004',
  name: '迁怒',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 1 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '本回合每次退治/超度妖怪+2伤害',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    ctx.player.tempBuffs.push({
      type: 'EXILE_KILL_DAMAGE',
      bonus: 2,
      sourceSkill: '迁怒',
    } as any);
    return { success: true, message: '退治/超度妖怪时+2伤害' };
  },
};

/**
 * shikigami_009 — 鬼使白「魂狩」
 * 【启】鬼火-1：本回合首次退治HP≤6的妖怪进入手牌
 */
const onimashira: ShikigamiSkillDef = {
  skillId: 'shikigami_009:魂狩',
  shikigamiId: 'shikigami_009',
  name: '魂狩',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 1 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '本回合首次退治HP≤6的妖怪进入手牌',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    ctx.player.tempBuffs.push({
      type: 'FIRST_KILL_TO_HAND',
      maxHp: 6,
      triggered: false,
      sourceSkill: '魂狩',
    } as any);
    return { success: true, message: '首次退治的妖怪进入手牌' };
  },
};

/**
 * shikigami_007 — 狂骨「杀戮」
 * 【启】鬼火-1：伤害+2
 */
const kyoukotsu: ShikigamiSkillDef = {
  skillId: 'shikigami_007:杀戮',
  shikigamiId: 'shikigami_007',
  name: '杀戮',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 1 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '伤害+2',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    ctx.player.damage += 2;
    return { success: true, message: '伤害+2' };
  },
};

/**
 * shikigami_003 — 座敷童子「灵之火」
 * 【启】鬼火-0：鬼火+1（不超上限）
 */
const zashikiWarashi: ShikigamiSkillDef = {
  skillId: 'shikigami_003:灵之火',
  shikigamiId: 'shikigami_003',
  name: '灵之火',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'NONE' },
  isHarassment: false,
  usesPerTurn: 1,
  description: '鬼火+1',
  canUse: (ctx: SkillContext) => {
    // 检查鬼火是否已满
    if (ctx.player.ghostFire >= ctx.player.maxGhostFire) {
      return '鬼火已满';
    }
    return null;
  },
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    ctx.player.ghostFire = Math.min(ctx.player.ghostFire + 1, ctx.player.maxGhostFire);
    return { success: true, message: '鬼火+1' };
  },
};

/**
 * shikigami_018 — 大天狗「羽刃暴风」
 * 【启】鬼火-2：伤害+3（简化版，完整版需要联动目标选择）
 */
const otengu: ShikigamiSkillDef = {
  skillId: 'shikigami_018:羽刃暴风',
  shikigamiId: 'shikigami_018',
  name: '羽刃暴风',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 2 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '伤害+3（简化版）',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    // TODO: 完整版需要联动目标选择 + LINKED_TARGET_DAMAGE buff
    ctx.player.damage += 3;
    return { success: true, message: '伤害+3' };
  },
};

/**
 * shikigami_020 — 酒吞童子「酒葫芦」
 * 【启】鬼火-1：抓1张牌
 */
const shuten: ShikigamiSkillDef = {
  skillId: 'shikigami_020:酒葫芦',
  shikigamiId: 'shikigami_020',
  name: '酒葫芦',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'GHOST_FIRE', amount: 1 },
  isHarassment: false,
  usesPerTurn: 1,
  description: '抓1张牌',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    const drawn = ctx.drawCards(ctx.player, 1);
    return { success: true, message: `抓${drawn}张牌` };
  },
};

/**
 * shikigami_021 — 食梦貘「沉睡」
 * 【启】鬼火-0：跳过清理阶段（不弃牌不抓牌），保留手牌
 */
const baku: ShikigamiSkillDef = {
  skillId: 'shikigami_021:沉睡',
  shikigamiId: 'shikigami_021',
  name: '沉睡',
  effectType: '启',
  trigger: 'ACTIVE',
  cost: { kind: 'NONE' },
  isHarassment: false,
  usesPerTurn: 1,
  description: '跳过清理阶段，保留手牌',
  canUse: () => null,
  execute: async (ctx: SkillContext): Promise<SkillResult> => {
    ctx.player.tempBuffs.push({
      type: 'SKIP_CLEANUP',
      sourceSkill: '沉睡',
    } as any);
    // 同时添加沉睡状态标记
    ctx.player.tempBuffs.push({
      type: 'SLEEP_STATE',
      sourceSkill: '沉睡',
    } as any);
    // 在 ShikigamiState 上标记 sleep
    ctx.shikigamiState.statusFlags.push('sleep');
    return {
      success: true,
      message: '进入沉睡，跳过清理阶段',
      skipCleanup: true,
    };
  },
};

// ============ 所有技能定义汇总 ============

/**
 * 所有已迁移的式神技能定义
 * 供 ShikigamiSkillEngine.registerAll() 使用
 */
export const SKILL_DEFS: ShikigamiSkillDef[] = [
  yamawaro,         // 山童「怪力」
  ibarakiDouji,     // 茨木童子「迁怒」
  onimashira,       // 鬼使白「魂狩」
  kyoukotsu,        // 狂骨「杀戮」
  zashikiWarashi,   // 座敷童子「灵之火」
  otengu,           // 大天狗「羽刃暴风」
  shuten,           // 酒吞童子「酒葫芦」
  baku,             // 食梦貘「沉睡」
];

// ============ 导出单个定义（测试用） ============

export {
  yamawaro,
  ibarakiDouji,
  onimashira,
  kyoukotsu,
  zashikiWarashi,
  otengu,
  shuten,
  baku,
};
