/**
 * 御魂传说 - 卡牌类型定义
 * @file shared/types/cards.ts
 * @version 0.3 - 根据规则书更新
 */
/** 卡牌类型枚举 */
export type CardType = 'onmyoji' | 'shikigami' | 'spell' | 'token' | 'penalty' | 'boss' | 'yokai';
/** 卡牌子类型（效果标签） */
export type CardSubtype = '御魂' | '鬼火' | '令牌' | '妨害' | '持续';
/** 效果类型标记 */
export type EffectType = '启' | '触' | '永' | '妖' | '自';
/** 阴阳师卡 - 只有名称和形象，无技能（为了玩家平衡） */
export interface OnmyojiCard {
    id: string;
    name: string;
    type: 'onmyoji';
    image: string;
}
export interface ShikigamiSkill {
    name: string;
    cost: number;
    effect: string;
    effectType: EffectType;
}
export interface ShikigamiPassive {
    name: string;
    effect: string;
    effectType: EffectType;
}
type ShikigamiRarity = 'SSR' | 'SR' | 'R';
export interface ShikigamiCard {
    id: string;
    name: string;
    type: 'shikigami';
    rarity: ShikigamiRarity;
    category: string;
    charm: number;
    passive: ShikigamiPassive;
    skill: ShikigamiSkill;
    multiPlayer?: boolean;
    image: string;
}
export interface SpellCard {
    id: string;
    name: string;
    type: 'spell';
    hp: number;
    damage: number;
    charm: number;
    effect?: string;
    count: number;
    image: string;
}
export interface TokenCard {
    id: string;
    name: string;
    type: 'token';
    hp: number;
    charm: number;
    count: number;
    image: string;
}
export interface PenaltyCard {
    id: string;
    name: string;
    type: 'penalty';
    hp: number;
    charm: number;
    count: number;
    image: string;
}
export type BossStage = 1 | 2 | 3;
export interface BossCard {
    id: string;
    name: string;
    type: 'boss';
    stage: BossStage;
    hp: number;
    charm: number;
    arrivalEffect: string;
    yokaiEffect: string;
    multiPlayer?: boolean;
    image: string;
}
export interface YokaiCard {
    id: string;
    name: string;
    type: 'yokai';
    hp: number;
    charm: number;
    keywords: string[];
    effect: string;
    effectType: EffectType;
    fieldEffect?: string;
    multiPlayer?: boolean;
    image: string;
}
/** 所有御魂卡（可进入玩家牌库的卡） */
export type YuhunCard = SpellCard | TokenCard | PenaltyCard | YokaiCard | BossCard;
/** 所有卡牌类型 */
export type AnyCard = OnmyojiCard | ShikigamiCard | YuhunCard;
/** 卡牌实例（游戏中的具体一张牌） */
export interface CardInstance {
    instanceId: string;
    cardId: string;
    cardType: CardType;
    name: string;
    hp: number;
    maxHp: number;
    currentHp?: number;
    damage?: number;
    charm?: number;
    effect?: string;
    keywords?: string[];
    image: string;
    isExhausted?: boolean;
    markers?: Record<string, number>;
}
export interface PlayerSetup {
    startingDeck: {
        spell: {
            name: string;
            count: number;
        };
        token: {
            name: string;
            count: number;
        };
    };
    handSize: number;
    shikigamiDraw: number;
    shikigamiKeep: number;
}
export interface GameSetupConfig {
    yokaiPerType: number;
    fortuneDaruma: number;
    farmer: number;
    warrior?: number;
}
export interface GameConstants {
    maxGhostFire: number;
    ghostFirePerTurn: number;
    yokaiSlots: number;
    maxShikigami: number;
}
export interface CardDatabase {
    version: string;
    totalCards: number;
    onmyoji: OnmyojiCard[];
    shikigami: ShikigamiCard[];
    spell: SpellCard[];
    token: TokenCard[];
    penalty: PenaltyCard[];
    boss: BossCard[];
    yokai: YokaiCard[];
    playerSetup: PlayerSetup;
    gameSetup: {
        '2players': GameSetupConfig;
        '3players': GameSetupConfig;
        '4players': GameSetupConfig;
        '5players': GameSetupConfig;
        '6players': GameSetupConfig;
    };
    gameConstants: GameConstants;
}
export {};
//# sourceMappingURL=cards.d.ts.map