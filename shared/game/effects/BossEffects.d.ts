/**
 * 鬼王效果处理器
 * 实现10个鬼王的来袭效果和御魂效果
 */
import { CardInstance, PlayerState, GameState } from '../../types';
interface BossEffectResult {
    success: boolean;
    message: string;
}
interface BossEffectContext {
    gameState: GameState;
    bossCard: CardInstance;
    onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
    onChoice?: (options: string[]) => Promise<number>;
    /** 检查玩家是否用青女房防御来袭效果，返回true表示免疫 */
    onCheckBossRaidDefense?: (player: PlayerState, bossName: string) => Promise<boolean>;
}
type ArrivalHandler = (ctx: BossEffectContext) => Promise<BossEffectResult>;
type SoulHandler = (ctx: BossEffectContext & {
    player: PlayerState;
}) => Promise<BossEffectResult>;
declare const arrivalHandlers: Map<string, ArrivalHandler>;
declare const soulHandlers: Map<string, SoulHandler>;
export declare function executeBossArrival(bossName: string, ctx: BossEffectContext): Promise<BossEffectResult>;
export declare function executeBossSoul(bossName: string, ctx: BossEffectContext & {
    player: PlayerState;
}): Promise<BossEffectResult>;
declare function drawCards(player: PlayerState, count: number): number;
declare function createPenaltyCard(): CardInstance;
export declare function checkBossRecoveryOnTurnStart(player: PlayerState): CardInstance | null;
export declare function recoverBossToHand(player: PlayerState, card: CardInstance): boolean;
export declare function checkKirinEndOfTurn(player: PlayerState): boolean;
export declare function clearOrochiEffect(gameState: GameState): void;
export declare function clearEarthquakeCatfishEffect(gameState: GameState): void;
export { drawCards, createPenaltyCard, arrivalHandlers, soulHandlers };
//# sourceMappingURL=BossEffects.d.ts.map