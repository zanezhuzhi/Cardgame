"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempBuffManager = void 0;
// ============ TempBuff 管理器 ============
class TempBuffManager {
    buffs;
    constructor(initial = []) {
        // 深拷贝，避免意外引用共享
        this.buffs = initial.map(b => ({ ...b }));
    }
    // ── 基础操作 ────────────────────────────────────────────────────
    /** 添加 Buff（addBuff / add 均可） */
    addBuff(buff) {
        this.buffs.push(buff);
    }
    /** @alias addBuff */
    add(buff) {
        this.addBuff(buff);
    }
    /** 获取所有指定类型的 Buff */
    get(type) {
        return this.buffs.filter(b => b.type === type);
    }
    /** 检查是否有指定类型的 Buff */
    has(type) {
        return this.buffs.some(b => b.type === type);
    }
    /** 移除指定类型的所有 Buff */
    remove(type) {
        this.buffs = this.buffs.filter(b => b.type !== type);
    }
    /** 清空所有 Buff（回合结束时调用） */
    clear() {
        this.buffs = [];
    }
    /** 获取当前 buff 列表（写回 PlayerState 用） */
    getBuffs() {
        return this.buffs;
    }
    // ── 消费型触发器（Consume = 使用后递减/移除）────────────────────
    /**
     * 消费通用伤害 bonus（DAMAGE_BONUS）
     * remainingCount > 0 时递减，-1 时永久有效
     * @returns 本次获得的额外伤害
     */
    consumeDamageBonus() {
        const buffs = this.get('DAMAGE_BONUS');
        let total = 0;
        for (const buff of buffs) {
            if (buff.remainingCount === -1 || buff.remainingCount > 0) {
                total += buff.bonus;
                if (buff.remainingCount > 0)
                    buff.remainingCount--;
            }
        }
        // 移除已耗尽的
        this.buffs = this.buffs.filter(b => b.type !== 'DAMAGE_BONUS' || b.remainingCount !== 0);
        return total;
    }
    /**
     * 消费阴阳术加伤（SPELL_DAMAGE_BONUS，带次数上限）
     * @returns 本次额外伤害值
     */
    consumeSpellDamageBonus() {
        const buffs = this.get('SPELL_DAMAGE_BONUS');
        let total = 0;
        for (const buff of buffs) {
            if (buff.remainingCount > 0) {
                total += buff.bonusPerSpell;
                buff.remainingCount--;
            }
        }
        // 移除已耗尽的
        this.buffs = this.buffs.filter(b => b.type !== 'SPELL_DAMAGE_BONUS' || b.remainingCount > 0);
        return total;
    }
    /** @alias consumeSpellDamageBonus（向后兼容旧名称） */
    triggerSpellDamageBonus() {
        return this.consumeSpellDamageBonus();
    }
    /**
     * 消费御魂双倍效果（NEXT_YOKAI_DOUBLE）
     * 触发后自动移除
     * @returns true 表示本张御魂效果应×2
     */
    consumeNextYokaiDouble() {
        if (this.has('NEXT_YOKAI_DOUBLE')) {
            this.remove('NEXT_YOKAI_DOUBLE');
            return true;
        }
        return false;
    }
    /** @alias consumeNextYokaiDouble */
    triggerNextYokaiDouble() {
        return this.consumeNextYokaiDouble();
    }
    /**
     * 消费式神技能加伤（SHIKIGAMI_SKILL_DAMAGE_BONUS）
     * @returns 额外伤害值
     */
    triggerShikigamiSkillBonus() {
        const buffs = this.get('SHIKIGAMI_SKILL_DAMAGE_BONUS');
        return buffs.reduce((sum, b) => sum + b.bonus, 0);
    }
    /**
     * 触发超度/退治加伤（EXILE_KILL_DAMAGE，不消耗，回合内持续）
     * @returns 本次额外伤害值
     */
    triggerExileKillBonus() {
        const buffs = this.get('EXILE_KILL_DAMAGE');
        return buffs.reduce((sum, b) => sum + b.bonus, 0);
    }
    /**
     * 触发首次对非女性目标加伤（三尾狐）
     * @param isFemale 目标是否为女性
     * @returns 额外伤害值
     */
    triggerFirstNonFemaleDamage(isFemale) {
        if (isFemale)
            return 0;
        const buffs = this.get('FIRST_NON_FEMALE_DAMAGE');
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
    getLinkedTargetBuff() {
        return this.get('LINKED_TARGET_DAMAGE')[0] ?? null;
    }
    /**
     * 消费鬼火额外获取（GHOST_FIRE_BONUS，带次数）
     * @returns 额外鬼火值
     */
    triggerGhostFireBonus() {
        const buffs = this.get('GHOST_FIRE_BONUS');
        let total = 0;
        for (const buff of buffs) {
            if (buff.remainingCount > 0) {
                total += buff.bonus;
                buff.remainingCount--;
            }
        }
        this.buffs = this.buffs.filter(b => b.type !== 'GHOST_FIRE_BONUS' || b.remainingCount > 0);
        return total;
    }
    /**
     * 触发鬼使白首次退治置入手牌
     * @param targetHp 目标妖怪的 HP
     * @returns true 表示应该置入手牌
     */
    triggerFirstKillToHand(targetHp) {
        const buffs = this.get('FIRST_KILL_TO_HAND');
        for (const buff of buffs) {
            if (!buff.triggered && targetHp <= buff.maxHp) {
                buff.triggered = true;
                return true;
            }
        }
        return false;
    }
    /** 是否需要跳过清理阶段（食梦貘） */
    shouldSkipCleanup() {
        return this.has('SKIP_CLEANUP');
    }
    /**
     * 获取式神技能消耗减少量（涅槃之火）
     * 多张叠加时累加所有 value
     * @returns 总减少量（用于计算实际消耗 = 原消耗 - 返回值，最低为 0）
     */
    getSkillCostReduction() {
        const buffs = this.get('SKILL_COST_REDUCTION');
        return buffs.reduce((sum, b) => sum + b.value, 0);
    }
    // ── 序列化 ──────────────────────────────────────────────────────
    /** 序列化（用于状态同步） */
    toJSON() {
        return [...this.buffs];
    }
    /** 从序列化数据恢复 */
    static fromJSON(data) {
        return new TempBuffManager(data);
    }
}
exports.TempBuffManager = TempBuffManager;
//# sourceMappingURL=TempBuff.js.map