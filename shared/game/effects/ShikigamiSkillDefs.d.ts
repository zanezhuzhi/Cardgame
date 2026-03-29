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
import type { ShikigamiSkillDef } from '../../types/shikigami';
/**
 * shikigami_022 — 山童「怪力」
 * 【启】鬼火-1：本回合前2张阴阳术+1伤害
 */
declare const yamawaro: ShikigamiSkillDef;
/**
 * shikigami_004 — 茨木童子「迁怒」
 * 【启】鬼火-1：本回合每退治/超度妖怪+2伤害
 */
declare const ibarakiDouji: ShikigamiSkillDef;
/**
 * shikigami_009 — 鬼使白「魂狩」
 * 【启】鬼火-1：本回合首次退治HP≤6的妖怪进入手牌
 */
declare const onimashira: ShikigamiSkillDef;
/**
 * shikigami_007 — 狂骨「杀戮」
 * 【启】鬼火-1：伤害+2
 */
declare const kyoukotsu: ShikigamiSkillDef;
/**
 * shikigami_003 — 座敷童子「灵之火」
 * 【启】鬼火-0：鬼火+1（不超上限）
 */
declare const zashikiWarashi: ShikigamiSkillDef;
/**
 * shikigami_018 — 大天狗「羽刃暴风」
 * 【启】鬼火-2：伤害+3（简化版，完整版需要联动目标选择）
 */
declare const otengu: ShikigamiSkillDef;
/**
 * shikigami_020 — 酒吞童子「酒葫芦」
 * 【启】鬼火-1：抓1张牌
 */
declare const shuten: ShikigamiSkillDef;
/**
 * shikigami_021 — 食梦貘「沉睡」
 * 【启】鬼火-0：跳过清理阶段（不弃牌不抓牌），保留手牌
 */
declare const baku: ShikigamiSkillDef;
/**
 * 所有已迁移的式神技能定义
 * 供 ShikigamiSkillEngine.registerAll() 使用
 */
export declare const SKILL_DEFS: ShikigamiSkillDef[];
export { yamawaro, ibarakiDouji, onimashira, kyoukotsu, zashikiWarashi, otengu, shuten, baku, };
//# sourceMappingURL=ShikigamiSkillDefs.d.ts.map