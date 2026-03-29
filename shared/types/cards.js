"use strict";
/**
 * 御魂传说 - 卡牌类型定义
 * @file shared/types/cards.ts
 * @version 0.3 - 根据规则书更新
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gender = void 0;
exports.isMale = isMale;
exports.isFemale = isFemale;
exports.hasGender = hasGender;
/** 性别位掩码常量 */
exports.Gender = {
    NONE: 0, // 无性别
    MALE: 1, // 男性
    FEMALE: 2, // 女性
    BOTH: 3, // 双性
};
/**
 * 判断是否为男性（男性或双性）
 */
function isMale(gender) {
    return ((gender ?? 0) & 1) !== 0;
}
/**
 * 判断是否为女性（女性或双性）
 */
function isFemale(gender) {
    return ((gender ?? 0) & 2) !== 0;
}
/**
 * 判断是否有性别（非无性别）
 */
function hasGender(gender) {
    return (gender ?? 0) !== 0;
}
//# sourceMappingURL=cards.js.map