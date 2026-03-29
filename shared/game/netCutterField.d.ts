/**
 * 网切 field 级 buff（与 server TempBuffHelper / YokaiEffects 使用同一结构）
 */
export type FieldWithNetCutter = {
    tempBuffs?: Array<{
        type?: string;
    }>;
};
export declare function fieldHasNetCutter(field: FieldWithNetCutter | null | undefined): boolean;
export declare function getNetCutterEffectiveHp(field: FieldWithNetCutter | null | undefined, baseHp: number, cardType: 'yokai' | 'boss'): number;
export declare function applyNetCutterToField(field: FieldWithNetCutter, opts?: {
    sourcePlayerId?: string;
}): void;
export declare function clearFieldNetCutter(field: FieldWithNetCutter | null | undefined): void;
//# sourceMappingURL=netCutterField.d.ts.map