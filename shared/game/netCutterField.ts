/**
 * 网切 field 级 buff（与 server TempBuffHelper / YokaiEffects 使用同一结构）
 */
export type FieldWithNetCutter = { tempBuffs?: Array<{ type?: string }> };

const NET = 'NET_CUTTER_HP_REDUCTION';

export function fieldHasNetCutter(field: FieldWithNetCutter | null | undefined): boolean {
  return ((field as any)?.tempBuffs || []).some((b: any) => b.type === NET);
}

export function getNetCutterEffectiveHp(
  field: FieldWithNetCutter | null | undefined,
  baseHp: number,
  cardType: 'yokai' | 'boss'
): number {
  if (!fieldHasNetCutter(field)) return baseHp;
  const reduction = cardType === 'boss' ? 2 : 1;
  return Math.max(1, baseHp - reduction);
}

export function applyNetCutterToField(
  field: FieldWithNetCutter,
  opts?: { sourcePlayerId?: string }
): void {
  const f = field as any;
  if (!f.tempBuffs) f.tempBuffs = [];
  f.tempBuffs = (f.tempBuffs as any[]).filter((b: any) => b.type !== NET);
  f.tempBuffs.push({
    type: NET,
    yokaiHpModifier: -1,
    bossHpModifier: -2,
    minHp: 1,
    expiresAt: 'endOfTurn',
    source: '网切',
    ...(opts?.sourcePlayerId != null ? { sourcePlayerId: opts.sourcePlayerId } : {}),
  });
}

export function clearFieldNetCutter(field: FieldWithNetCutter | null | undefined): void {
  const f = field as any;
  if (!f?.tempBuffs) return;
  f.tempBuffs = (f.tempBuffs as any[]).filter((b: any) => b.type !== NET);
}
