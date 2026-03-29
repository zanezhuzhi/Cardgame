/**
 * 回合外妨害管线选择超时/AI 默认项（与 SocketServer.runAiTurnStep 策略对齐）
 */
import type { PlayerState } from '../../types/game';
import type { CardInstance } from '../../types/cards';
import { aiDecide_雪幽魂 } from '../effects/YokaiEffects';

export type HarassmentPipelinePendingSlice = {
  options?: string[];
  meta?: { wangliangTargetId?: string };
};

export function defaultHarassmentPipelineChoiceIndex(
  pc: HarassmentPipelinePendingSlice,
  responder: PlayerState | undefined,
): number {
  const opts: string[] = pc.options || [];
  const opt0 = String(opts[0] ?? '');
  let choice = 0;
  if (opt0.includes('弃置1张手牌')) {
    choice = responder && responder.hand.length > 0 ? 0 : 1;
  } else if (pc.meta?.wangliangTargetId != null) {
    const tid = pc.meta.wangliangTargetId as string;
    choice = tid === responder?.id ? 0 : 1;
  } else if (
    opts.length === 2 &&
    opts[0] === '基础术式' &&
    opts[1] === '招福达摩'
  ) {
    choice = 0;
  } else if (opts.some(o => String(o).startsWith('弃置「')) && opts.length >= 2) {
    if (responder) {
      const penalties = responder.hand.filter((c: { cardType?: string }) => c.cardType === 'penalty');
      const pickId = aiDecide_雪幽魂(penalties as CardInstance[]);
      const ix = opts.findIndex(o => {
        const m = String(o).match(/弃置「(.+)」/);
        const card = penalties.find((p: { name?: string }) => p.name === m?.[1]);
        return card?.instanceId === pickId;
      });
      choice = ix >= 0 ? ix : 0;
    }
  }
  return choice;
}
