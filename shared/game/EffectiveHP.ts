/**
 * 御魂传说 - 动态HP计算系统
 * @file shared/game/EffectiveHP.ts
 * @description 实现临时HP修改器，用于网切等效果
 */

// ============ HP修改器类型 ============

/**
 * HP修改器类型
 */
export type HPModifierType = 
  | 'flat'       // 固定值修改 (如 网切: 全场+3)
  | 'multiply'   // 倍率修改 (如 某效果: HP*2)
  | 'set'        // 设置固定值 (如 某效果: HP=1)
  | 'min'        // 设置最小值 (如 某效果: HP>=5)
  | 'max';       // 设置最大值 (如 某效果: HP<=3)

/**
 * HP修改器
 */
export interface HPModifier {
  /** 唯一ID */
  id: string;
  /** 来源卡牌ID */
  sourceCardId: string;
  /** 来源卡牌名称 */
  sourceCardName: string;
  /** 来源玩家ID */
  sourcePlayerId: string;
  /** 修改器类型 */
  type: HPModifierType;
  /** 修改值 */
  value: number;
  /** 优先级（越大越先应用） */
  priority: number;
  /** 作用范围 */
  scope: HPModifierScope;
  /** 创建时间戳 */
  createdAt: number;
  /** 持续类型 */
  duration: HPModifierDuration;
  /** 回合数（仅当 duration 为 'turns' 时有效） */
  turnsRemaining?: number;
}

/**
 * HP修改器作用范围
 */
export interface HPModifierScope {
  /** 作用对象类型 */
  target: 'all' | 'yokai' | 'boss' | 'specific';
  /** 指定卡牌实例ID列表（仅当 target 为 'specific' 时有效） */
  cardInstanceIds?: string[];
  /** HP条件（如 网切: HP<6 的妖怪） */
  hpCondition?: {
    operator: '<' | '<=' | '=' | '>=' | '>' | '!=';
    value: number;
  };
}

/**
 * HP修改器持续类型
 */
export type HPModifierDuration = 
  | 'permanent'   // 永久（直到手动移除）
  | 'turnEnd'     // 回合结束
  | 'cleanup'     // 清理阶段
  | 'turns';      // 指定回合数

// ============ HP修改器管理 ============

/**
 * HP修改器管理器
 */
export interface HPModifierManager {
  /** 当前所有修改器 */
  modifiers: HPModifier[];
}

/**
 * 创建HP修改器管理器
 */
export function createHPModifierManager(): HPModifierManager {
  return { modifiers: [] };
}

/**
 * 添加HP修改器
 */
export function addHPModifier(
  manager: HPModifierManager,
  modifier: Omit<HPModifier, 'id' | 'createdAt'>
): string {
  const id = `hp_mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullModifier: HPModifier = {
    ...modifier,
    id,
    createdAt: Date.now(),
  };
  manager.modifiers.push(fullModifier);
  return id;
}

/**
 * 移除HP修改器
 */
export function removeHPModifier(manager: HPModifierManager, modifierId: string): boolean {
  const index = manager.modifiers.findIndex(m => m.id === modifierId);
  if (index !== -1) {
    manager.modifiers.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * 移除指定来源的所有HP修改器
 */
export function removeModifiersBySource(
  manager: HPModifierManager,
  sourceCardId: string
): number {
  const before = manager.modifiers.length;
  manager.modifiers = manager.modifiers.filter(m => m.sourceCardId !== sourceCardId);
  return before - manager.modifiers.length;
}

/**
 * 移除指定玩家的所有HP修改器
 */
export function removeModifiersByPlayer(
  manager: HPModifierManager,
  playerId: string
): number {
  const before = manager.modifiers.length;
  manager.modifiers = manager.modifiers.filter(m => m.sourcePlayerId !== playerId);
  return before - manager.modifiers.length;
}

/**
 * 清理回合结束的修改器
 */
export function cleanupTurnEndModifiers(manager: HPModifierManager): number {
  const before = manager.modifiers.length;
  manager.modifiers = manager.modifiers.filter(m => {
    if (m.duration === 'turnEnd') return false;
    if (m.duration === 'turns') {
      if (m.turnsRemaining !== undefined) {
        m.turnsRemaining--;
        return m.turnsRemaining > 0;
      }
    }
    return true;
  });
  return before - manager.modifiers.length;
}

/**
 * 清理清理阶段的修改器
 */
export function cleanupCleanupPhaseModifiers(manager: HPModifierManager): number {
  const before = manager.modifiers.length;
  manager.modifiers = manager.modifiers.filter(m => m.duration !== 'cleanup');
  return before - manager.modifiers.length;
}

// ============ 有效HP计算 ============

/**
 * 卡牌HP信息（用于计算）
 */
export interface CardHPInfo {
  instanceId: string;
  cardType: 'yokai' | 'boss';
  baseHp: number;
}

/**
 * 计算卡牌的有效HP
 * @param manager HP修改器管理器
 * @param card 卡牌HP信息
 * @returns 计算后的有效HP
 */
export function calculateEffectiveHP(
  manager: HPModifierManager,
  card: CardHPInfo
): number {
  let effectiveHp = card.baseHp;
  
  // 获取适用于此卡牌的所有修改器
  const applicableModifiers = getApplicableModifiers(manager, card);
  
  // 按优先级排序（高优先级先应用）
  applicableModifiers.sort((a, b) => b.priority - a.priority);
  
  // 分组处理：先处理 set/min/max，再处理 flat/multiply
  const setModifiers = applicableModifiers.filter(m => m.type === 'set');
  const minModifiers = applicableModifiers.filter(m => m.type === 'min');
  const maxModifiers = applicableModifiers.filter(m => m.type === 'max');
  const flatModifiers = applicableModifiers.filter(m => m.type === 'flat');
  const multiplyModifiers = applicableModifiers.filter(m => m.type === 'multiply');
  
  // 1. 应用固定值设置（最后一个生效）
  if (setModifiers.length > 0) {
    effectiveHp = setModifiers[setModifiers.length - 1].value;
  }
  
  // 2. 应用倍率修改
  for (const mod of multiplyModifiers) {
    effectiveHp = Math.floor(effectiveHp * mod.value);
  }
  
  // 3. 应用固定值修改
  for (const mod of flatModifiers) {
    effectiveHp += mod.value;
  }
  
  // 4. 应用最小值限制
  for (const mod of minModifiers) {
    effectiveHp = Math.max(effectiveHp, mod.value);
  }
  
  // 5. 应用最大值限制
  for (const mod of maxModifiers) {
    effectiveHp = Math.min(effectiveHp, mod.value);
  }
  
  // HP最低为1
  return Math.max(1, effectiveHp);
}

/**
 * 获取适用于指定卡牌的所有修改器
 */
export function getApplicableModifiers(
  manager: HPModifierManager,
  card: CardHPInfo
): HPModifier[] {
  return manager.modifiers.filter(mod => {
    // 检查目标类型
    if (mod.scope.target === 'all') return true;
    if (mod.scope.target === 'yokai' && card.cardType !== 'yokai') return false;
    if (mod.scope.target === 'boss' && card.cardType !== 'boss') return false;
    if (mod.scope.target === 'specific') {
      if (!mod.scope.cardInstanceIds?.includes(card.instanceId)) return false;
    }
    
    // 检查HP条件（基于基础HP）
    if (mod.scope.hpCondition) {
      const { operator, value } = mod.scope.hpCondition;
      switch (operator) {
        case '<': if (!(card.baseHp < value)) return false; break;
        case '<=': if (!(card.baseHp <= value)) return false; break;
        case '=': if (!(card.baseHp === value)) return false; break;
        case '>=': if (!(card.baseHp >= value)) return false; break;
        case '>': if (!(card.baseHp > value)) return false; break;
        case '!=': if (!(card.baseHp !== value)) return false; break;
      }
    }
    
    return true;
  });
}

// ============ 网切效果专用函数 ============

/**
 * 创建网切效果的HP修改器（返回两个修改器）
 * @description 网切: 本回合所有妖怪HP-1，鬼王HP-2，最低1（回合结束清除）
 */
export function createNetCutterModifiers(
  playerId: string
): Omit<HPModifier, 'id' | 'createdAt'>[] {
  return [
    {
      sourceCardId: 'yokai_020',  // 网切
      sourceCardName: '网切',
      sourcePlayerId: playerId,
      type: 'flat',
      value: -1,
      priority: 10,
      scope: { target: 'yokai' },
      duration: 'turnEnd',
    },
    {
      sourceCardId: 'yokai_020',  // 网切
      sourceCardName: '网切',
      sourcePlayerId: playerId,
      type: 'flat',
      value: -2,
      priority: 10,
      scope: { target: 'boss' },
      duration: 'turnEnd',
    },
  ];
}

/** @deprecated 使用 createNetCutterModifiers（返回数组）替代 */
export function createNetCutterModifier(
  playerId: string,
  _hpBonus?: number
): Omit<HPModifier, 'id' | 'createdAt'> {
  // 向后兼容：返回妖怪HP-1修改器
  return createNetCutterModifiers(playerId)[0];
}

/**
 * 为 HPModifierManager 添加网切效果（覆盖不叠加）
 * @description 先移除已有的网切修改器，再添加新的
 */
export function applyNetCutterEffect(manager: HPModifierManager, playerId: string): void {
  // 移除已存在的网切修改器（确保不叠加）
  removeModifiersBySource(manager, 'yokai_020');
  // 添加新的网切修改器（妖怪-1 + 鬼王-2）
  for (const mod of createNetCutterModifiers(playerId)) {
    addHPModifier(manager, mod);
  }
}

/**
 * 检查网切效果是否已激活
 */
export function isNetCutterActive(manager: HPModifierManager): boolean {
  return manager.modifiers.some(m => m.sourceCardId === 'yokai_020');
}

/**
 * 获取网切效果的HP修正值
 * @param type 'yokai' 返回妖怪修正值(-1)，'boss' 返回鬼王修正值(-2)
 */
export function getNetCutterBonus(manager: HPModifierManager, type: 'yokai' | 'boss' = 'yokai'): number {
  const netCutterMod = manager.modifiers.find(
    m => m.sourceCardId === 'yokai_020' && m.scope.target === type
  );
  return netCutterMod?.value ?? 0;
}

// ============ 批量计算 ============

/**
 * 批量计算多张卡牌的有效HP
 */
export function calculateAllEffectiveHP(
  manager: HPModifierManager,
  cards: CardHPInfo[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const card of cards) {
    result.set(card.instanceId, calculateEffectiveHP(manager, card));
  }
  return result;
}

/**
 * 获取所有活跃的HP修改器摘要
 */
export function getActiveModifiersSummary(manager: HPModifierManager): string[] {
  return manager.modifiers.map(m => {
    const sign = m.value >= 0 ? '+' : '';
    let targetDesc = '';
    switch (m.scope.target) {
      case 'all': targetDesc = '全场'; break;
      case 'yokai': targetDesc = '妖怪'; break;
      case 'boss': targetDesc = '鬼王'; break;
      case 'specific': targetDesc = '指定目标'; break;
    }
    if (m.scope.hpCondition) {
      targetDesc += `(HP${m.scope.hpCondition.operator}${m.scope.hpCondition.value})`;
    }
    return `[${m.sourceCardName}] ${targetDesc} HP${sign}${m.value}`;
  });
}
