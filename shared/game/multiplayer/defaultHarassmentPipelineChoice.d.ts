/**
 * 回合外妨害管线选择超时/AI 默认项（与 SocketServer.runAiTurnStep 策略对齐）
 */
import type { PlayerState } from '../../types/game';
export type HarassmentPipelinePendingSlice = {
    options?: string[];
    meta?: {
        wangliangTargetId?: string;
    };
};
export declare function defaultHarassmentPipelineChoiceIndex(pc: HarassmentPipelinePendingSlice, responder: PlayerState | undefined): number;
//# sourceMappingURL=defaultHarassmentPipelineChoice.d.ts.map