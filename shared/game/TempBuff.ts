/**
 * 御魂传说 - 回合临时增益（TempBuff）系统
 * @file shared/game/TempBuff.ts
 *
 * TempBuff 是回合内有效的临时状态修饰符。
 * 每个 Buff 在回合结束的清理阶段（cleanup）被统一清空。
 *
 * 设计原则：
 *  - 所有 Buff 都是"加法器"，最终由 GameManager 在执行动作时叠加
 *  - 带计数上限的 Buff（如山童怪力）用 remainingCount 控制剩余触发次数
 *  - GameManager 读取 Buff 后若 remainingCount 归零则自动移除
 */

// ============ Buff 类型枚举 ============

export type TempBuffType =
  // ----- 伤害相关 -----
  | 'DAMAGE_BONUS'                   // 本回合通用加伤（remainingCount 控制次数，-1=无限）
  | 'SHIKIGAMI_SKILL_DAMAGE_BONUS'   // 使用式神技能时额外伤害（狂骨）
  | 'SPELL_DAMAGE_BONUS'             // 每打1张阴阳术额外+N伤害（山童怪力）
  | 'EXILE_KILL_DAMAGE'              // 每超度或退治妖怪+N伤害（茨木迁怒）
  | 'FIRST_NON_FEMALE_DAMAGE'        // 首次对非女性目标+N伤害（三尾狐）
  | 'LINKED_TARGET_DAMAGE'           // 联动目标伤害（大天狗羽刃暴风）

  // ----- 鬼火相关 -----
  | 'GHOST_FIRE_BONUS'               // 本回合获得鬼火额外+N（三味共鸣）

  // ----- 卡牌效果相关 -----
  | 'NEXT_YOKAI_DOUBLE'              // 下一张御魂效果×2（轮入道）
  | 'FIRST_KILL_TO_HAND'             // 首次退治HP≤N的妖怪置入手牌（鬼使白魂狩）

  // ----- 弃牌加伤 -----
  | 'DISCARD_FOR_DAMAGE'             // 弃牌触发加伤（白狼冥想）

  // ----- 回合结构相关 -----
  | 'SKIP_CLEANUP'                   // 跳过清理阶段（食梦貘沉睡）

  // ----- 式神技能相关（新增） -----
  | 'SKILL_COST_REDUCTION'           // 式神技能鬼火消耗-N（涅槃之火）
  | 'HARASS_COUNT'                   // 本回合妨害次数追踪（HarassmentPipeline 用）
  | 'EXTRA_TURN'                     // 额外回合（追月神觉醒技）
  | 'DRAW_BONUS'                     // 本回合抓牌额外+N（花鸟卷抵抗后的补偿等）
  | 'KACHOU_RESIST_USED'             // 花鸟卷抵抗已使用标记（每回合限1次）
  | 'USHI_HARASS_REWARD'             // 丑时之女：首次妨害时抓牌+1
  | 'SLEEP_STATE'                    // 食梦貘沉睡状态标记（区分 SKIP_CLEANUP 的语义）
  | 'YUMEKUI_DREAM_SHIELD'           // 食梦貘梦境保护（沉睡中受妨害弃牌触发）
  | 'SKILL_DAMAGE_PER_FIRE'          // 按鬼火数加伤（书翁墨龙：每消耗N鬼火+M伤害）
  | 'KILL_DRAW_BONUS'                // 退治妖怪时抓牌（山兔蹦跳：每退治抓+1牌）
  | 'IMMUNITY_HARASSMENT';           // 妨害完全免疫（青女房展示后本次免疫标记）

// ============ 基础 Buff 结构 ============

export interface BaseTempBuff {
  type: TempBuffType;
  sourceCardId?: string;    // 来源卡牌 ID（用于日志/调试）
  sourceSkill?: string;     // 来源技能名
}

// ----- 伤害类 -----

export interface DamageBonusBuff extends BaseTempBuff {
  type: 'DAMAGE_BONUS';
  bonus: number;
  remainingCount: number;   // -1 = 无限次；>0 = 剩余次数
}

export interface ShikigamiSkillDamageBuff extends BaseTempBuff {
  type: 'SHIKIGAMI_SKILL_DAMAGE_BONUS';
  bonus: number;
}

export interface SpellDamageBuff extends BaseTempBuff {
  type: 'SPELL_DAMAGE_BONUS';
  bonusPerSpell: number;    // 每次触发的加伤量
  remainingCount: number;   // 剩余可触发次数（山童：2次）
}

export interface ExileKillDamageBuff extends BaseTempBuff {
  type: 'EXILE_KILL_DAMAGE';
  bonus: number;            // 每次触发的伤害量（茨木：+2）
}

export interface FirstNonFemaleDamageBuff extends BaseTempBuff {
  type: 'FIRST_NON_FEMALE_DAMAGE';
  bonus: number;
  triggered: boolean;       // 是否已触发过
}

export interface LinkedTargetDamageBuff extends BaseTempBuff {
  type: 'LINKED_TARGET_DAMAGE';
  targetInstanceId: string; // 被标记的联动目标
  reduction: number;        // 伤害减少量（大天狗：-2）
}

// ----- 鬼火类 -----

export interface GhostFireBonusBuff extends BaseTempBuff {
  type: 'GHOST_FIRE_BONUS';
  bonus: number;
  remainingCount: number;
}

// ----- 卡牌效果类 -----

export interface NextYokaiDoubleBuff extends BaseTempBuff {
  type: 'NEXT_YOKAI_DOUBLE';
}

export interface FirstKillToHandBuff extends BaseTempBuff {
  type: 'FIRST_KILL_TO_HAND';
  maxHp: number;            // 鬼使白：HP ≤ 6
  triggered: boolean;
}

// ----- 弃牌加伤 -----

export interface DiscardForDamageBuff extends BaseTempBuff {
  type: 'DISCARD_FOR_DAMAGE';
  active: boolean;
}

// ----- 回合结构类 -----

export interface SkipCleanupBuff extends BaseTempBuff {
  type: 'SKIP_CLEANUP';
}

// ----- 式神技能相关（新增） -----

/** 式神技能鬼火消耗减少（涅槃之火） */
export interface SkillCostReductionBuff extends BaseTempBuff {
  type: 'SKILL_COST_REDUCTION';
  value: number;            // 减少的鬼火消耗量（可叠加）
  source?: string;          // 来源卡牌名（如 '涅槃之火'）
}

/** 本回合妨害次数追踪（HarassmentPipeline 内部使用） */
export interface HarassCountBuff extends BaseTempBuff {
  type: 'HARASS_COUNT';
  value: number;            // 本回合妨害次数
}

/** 额外回合（追月神觉醒技） */
export interface ExtraTurnBuff extends BaseTempBuff {
  type: 'EXTRA_TURN';
}

/** 本回合抓牌额外+N */
export interface DrawBonusBuff extends BaseTempBuff {
  type: 'DRAW_BONUS';
  bonus: number;            // 抓牌时额外+N
  remainingCount: number;   // -1 = 无限次
}

/** 花鸟卷抵抗已使用标记（每回合限1次） */
export interface KachouResistUsedBuff extends BaseTempBuff {
  type: 'KACHOU_RESIST_USED';
}

/** 丑时之女：首次妨害时抓牌+1 */
export interface UshiHarassRewardBuff extends BaseTempBuff {
  type: 'USHI_HARASS_REWARD';
  drawBonus: number;        // 抓牌数（默认1）
  triggered: boolean;       // 是否已触发
}

/** 食梦貘沉睡状态标记 */
export interface SleepStateBuff extends BaseTempBuff {
  type: 'SLEEP_STATE';
}

/** 食梦貘梦境保护（沉睡中受妨害弃牌触发） */
export interface YumekuiDreamShieldBuff extends BaseTempBuff {
  type: 'YUMEKUI_DREAM_SHIELD';
  discardCount: number;     // 受妨害时弃牌数
}

/** 按鬼火数加伤（书翁墨龙） */
export interface SkillDamagePerFireBuff extends BaseTempBuff {
  type: 'SKILL_DAMAGE_PER_FIRE';
  damagePerFire: number;    // 每消耗1鬼火+M伤害
  firePaid: number;         // 已消耗的鬼火数
}

/** 退治妖怪时抓牌（山兔蹦跳） */
export interface KillDrawBonusBuff extends BaseTempBuff {
  type: 'KILL_DRAW_BONUS';
  drawCount: number;        // 每次退治抓N张（山兔：1）
  remainingCount: number;   // -1 = 无限次
}

/** 妨害完全免疫（青女房展示后的标记） */
export interface ImmunityHarassmentBuff extends BaseTempBuff {
  type: 'IMMUNITY_HARASSMENT';
}

// ============ 联合类型 ============

export type TempBuff =
  | DamageBonusBuff
  | ShikigamiSkillDamageBuff
  | SpellDamageBuff
  | ExileKillDamageBuff
  | FirstNonFemaleDamageBuff
  | LinkedTargetDamageBuff
  | GhostFireBonusBuff
  | NextYokaiDoubleBuff
  | FirstKillToHandBuff
  | DiscardForDamageBuff
  | SkipCleanupBuff
  // 式神技能相关（新增）
  | SkillCostReductionBuff
  | HarassCountBuff
  | ExtraTurnBuff
  | DrawBonusBuff
  | KachouResistUsedBuff
  | UshiHarassRewardBuff
  | SleepStateBuff
  | YumekuiDreamShieldBuff
  | SkillDamagePerFireBuff
  | KillDrawBonusBuff
  | ImmunityHarassmentBuff;

// ============ TempBuff 管理器 ============

export class TempBuffManager {

  private buffs: TempBuff[];

  constructor(initial: TempBuff[] = []) {
    // 深拷贝，避免意外引用共享
    this.buffs = initial.map(b => ({ ...b }));
  }

  // ── 基础操作 ────────────────────────────────────────────────────

  /** 添加 Buff（addBuff / add 均可） */
  addBuff(buff: TempBuff): void {
    this.buffs.push(buff);
  }

  /** @alias addBuff */
  add(buff: TempBuff): void {
    this.addBuff(buff);
  }

  /** 获取所有指定类型的 Buff */
  get<T extends TempBuff>(type: TempBuffType): T[] {
    return this.buffs.filter(b => b.type === type) as T[];
  }

  /** 检查是否有指定类型的 Buff */
  has(type: TempBuffType): boolean {
    return this.buffs.some(b => b.type === type);
  }

  /** 移除指定类型的所有 Buff */
  remove(type: TempBuffType): void {
    this.buffs = this.buffs.filter(b => b.type !== type);
  }

  /** 清空所有 Buff（回合结束时调用） */
  clear(): void {
    this.buffs = [];
  }

  /** 获取当前 buff 列表（写回 PlayerState 用） */
  getBuffs(): TempBuff[] {
    return this.buffs;
  }

  // ── 消费型触发器（Consume = 使用后递减/移除）────────────────────

  /**
   * 消费通用伤害 bonus（DAMAGE_BONUS）
   * remainingCount > 0 时递减，-1 时永久有效
   * @returns 本次获得的额外伤害
   */
  consumeDamageBonus(): number {
    const buffs = this.get<DamageBonusBuff>('DAMAGE_BONUS');
    let total = 0;
    for (const buff of buffs) {
      if (buff.remainingCount === -1 || buff.remainingCount > 0) {
        total += buff.bonus;
        if (buff.remainingCount > 0) buff.remainingCount--;
      }
    }
    // 移除已耗尽的
    this.buffs = this.buffs.filter(
      b => b.type !== 'DAMAGE_BONUS' || (b as DamageBonusBuff).remainingCount !== 0
    );
    return total;
  }

  /**
   * 消费阴阳术加伤（SPELL_DAMAGE_BONUS，带次数上限）
   * @returns 本次额外伤害值
   */
  consumeSpellDamageBonus(): number {
    const buffs = this.get<SpellDamageBuff>('SPELL_DAMAGE_BONUS');
    let total = 0;
    for (const buff of buffs) {
      if (buff.remainingCount > 0) {
        total += buff.bonusPerSpell;
        buff.remainingCount--;
      }
    }
    // 移除已耗尽的
    this.buffs = this.buffs.filter(
      b => b.type !== 'SPELL_DAMAGE_BONUS' || (b as SpellDamageBuff).remainingCount > 0
    );
    return total;
  }

  /** @alias consumeSpellDamageBonus（向后兼容旧名称） */
  triggerSpellDamageBonus(): number {
    return this.consumeSpellDamageBonus();
  }

  /**
   * 消费御魂双倍效果（NEXT_YOKAI_DOUBLE）
   * 触发后自动移除
   * @returns true 表示本张御魂效果应×2
   */
  consumeNextYokaiDouble(): boolean {
    if (this.has('NEXT_YOKAI_DOUBLE')) {
      this.remove('NEXT_YOKAI_DOUBLE');
      return true;
    }
    return false;
  }

  /** @alias consumeNextYokaiDouble */
  triggerNextYokaiDouble(): boolean {
    return this.consumeNextYokaiDouble();
  }

  /**
   * 消费式神技能加伤（SHIKIGAMI_SKILL_DAMAGE_BONUS）
   * @returns 额外伤害值
   */
  triggerShikigamiSkillBonus(): number {
    const buffs = this.get<ShikigamiSkillDamageBuff>('SHIKIGAMI_SKILL_DAMAGE_BONUS');
    return buffs.reduce((sum, b) => sum + b.bonus, 0);
  }

  /**
   * 触发超度/退治加伤（EXILE_KILL_DAMAGE，不消耗，回合内持续）
   * @returns 本次额外伤害值
   */
  triggerExileKillBonus(): number {
    const buffs = this.get<ExileKillDamageBuff>('EXILE_KILL_DAMAGE');
    return buffs.reduce((sum, b) => sum + b.bonus, 0);
  }

  /**
   * 触发首次对非女性目标加伤（三尾狐）
   * @param isFemale 目标是否为女性
   * @returns 额外伤害值
   */
  triggerFirstNonFemaleDamage(isFemale: boolean): number {
    if (isFemale) return 0;
    const buffs = this.get<FirstNonFemaleDamageBuff>('FIRST_NON_FEMALE_DAMAGE');
    let total = 0;
    for (const buff of buffs) {
      if (!buff.triggered) {
        total += buff.bonus;
        buff.triggered = true;
      }
    }
    return total;
  }

  /** 获取联动目标 Buff（大天狗） */
  getLinkedTargetBuff(): LinkedTargetDamageBuff | null {
    return this.get<LinkedTargetDamageBuff>('LINKED_TARGET_DAMAGE')[0] ?? null;
  }

  /**
   * 消费鬼火额外获取（GHOST_FIRE_BONUS，带次数）
   * @returns 额外鬼火值
   */
  triggerGhostFireBonus(): number {
    const buffs = this.get<GhostFireBonusBuff>('GHOST_FIRE_BONUS');
    let total = 0;
    for (const buff of buffs) {
      if (buff.remainingCount > 0) {
        total += buff.bonus;
        buff.remainingCount--;
      }
    }
    this.buffs = this.buffs.filter(
      b => b.type !== 'GHOST_FIRE_BONUS' || (b as GhostFireBonusBuff).remainingCount > 0
    );
    return total;
  }

  /**
   * 触发鬼使白首次退治置入手牌
   * @param targetHp 目标妖怪的 HP
   * @returns true 表示应该置入手牌
   */
  triggerFirstKillToHand(targetHp: number): boolean {
    const buffs = this.get<FirstKillToHandBuff>('FIRST_KILL_TO_HAND');
    for (const buff of buffs) {
      if (!buff.triggered && targetHp <= buff.maxHp) {
        buff.triggered = true;
        return true;
      }
    }
    return false;
  }

  /** 是否需要跳过清理阶段（食梦貘） */
  shouldSkipCleanup(): boolean {
    return this.has('SKIP_CLEANUP');
  }

  /**
   * 获取式神技能消耗减少量（涅槃之火）
   * 多张叠加时累加所有 value
   * @returns 总减少量（用于计算实际消耗 = 原消耗 - 返回值，最低为 0）
   */
  getSkillCostReduction(): number {
    const buffs = this.get<SkillCostReductionBuff>('SKILL_COST_REDUCTION');
    return buffs.reduce((sum, b) => sum + b.value, 0);
  }

  // ── 序列化 ──────────────────────────────────────────────────────

  /** 序列化（用于状态同步） */
  toJSON(): TempBuff[] {
    return [...this.buffs];
  }

  /** 从序列化数据恢复 */
  static fromJSON(data: TempBuff[]): TempBuffManager {
    return new TempBuffManager(data);
  }
}