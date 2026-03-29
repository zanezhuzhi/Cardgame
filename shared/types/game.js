"use strict";
/**
 * 御魂传说 - 游戏状态类型定义
 * @file shared/types/game.ts
 * @version 0.3 - 根据规则书更新
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GAME_CONFIG = void 0;
exports.createEmptyDamagePool = createEmptyDamagePool;
exports.getTotalDamage = getTotalDamage;
exports.getAvailableDamageForTarget = getAvailableDamageForTarget;
/** 创建空伤害池 */
function createEmptyDamagePool() {
    return { spell: 0, yokai: 0, shikigami: 0, other: 0 };
}
/** 计算伤害池总伤害 */
function getTotalDamage(pool) {
    return pool.spell + pool.yokai + pool.shikigami + pool.other;
}
/** 计算可用于指定目标的伤害（镜姬免疫spell） */
function getAvailableDamageForTarget(pool, isImmuneToSpell) {
    if (isImmuneToSpell) {
        return pool.yokai + pool.shikigami + pool.other;
    }
    return pool.spell + pool.yokai + pool.shikigami + pool.other;
}
/** 默认游戏配置 */
exports.DEFAULT_GAME_CONFIG = {
    playerCount: 2,
    removeMultiPlayerCards: true,
    startingSpells: 6,
    startingTokens: 4,
    startingHandSize: 5,
    maxHandSize: -1,
    shikigamiDraw: 4,
    shikigamiKeep: 2,
    maxShikigami: 3,
    maxGhostFire: 5,
    ghostFirePerTurn: 1,
    yokaiSlots: 6,
};
//# sourceMappingURL=game.js.map