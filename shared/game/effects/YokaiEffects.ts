/**
 * 妖怪御魂效果处理器
 * 实现38种妖怪的御魂效果
 */

import { applyNetCutterToField as applyNetCutterFieldBuff } from '../netCutterField';

// 直接定义需要的类型接口（避免模块解析问题）
interface CardInstance {
  instanceId: string;
  cardId: string;
  cardType: string;
  name: string;
  hp?: number;
  maxHp?: number;
  damage?: number;
  tags?: string[];
  [key: string]: any;
}

interface PlayerState {
  id: string;
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exiled: CardInstance[];
  ghostFire: number;
  maxGhostFire: number;
  damage: number;
  tempBuffs: any[];
  [key: string]: any;
}

interface FieldState {
  yokaiSlots: (CardInstance | null)[];
  currentBoss?: CardInstance | null;
  boss?: CardInstance | null;
  bossMaxHp?: number;
  bossCurrentHp?: number;
  [key: string]: any;
}

interface GameState {
  players: PlayerState[];
  field: FieldState;
  [key: string]: any;
}

// 效果执行结果
interface EffectResult {
  success: boolean;
  message: string;
  draw?: number;
  damage?: number;
  ghostFire?: number;
}

// 效果上下文
interface EffectContext {
  player: PlayerState;
  gameState: GameState;
  card: CardInstance;
  onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
  onChoice?: (options: string[]) => Promise<number>;
  onSelectTarget?: (targets: CardInstance[]) => Promise<string>;
}

// 效果处理器类型
type EffectHandler = (ctx: EffectContext) => Promise<EffectResult>;

// 效果注册表
const effectHandlers = new Map<string, EffectHandler>();

// 注册效果
function registerEffect(name: string, handler: EffectHandler): void {
  effectHandlers.set(name, handler);
}

// 执行御魂效果
export async function executeYokaiEffect(
  yokaiName: string,
  ctx: EffectContext
): Promise<EffectResult> {
  const handler = effectHandlers.get(yokaiName);
  if (!handler) {
    return { success: false, message: `未找到妖怪效果: ${yokaiName}` };
  }
  return handler(ctx);
}

/** 与《卡牌开发》/ server drawCards 一致：手牌 ≥10 时跳过当次抓牌 */
const DRAW_HAND_LIMIT = 10;

// 辅助函数：抓牌（牌库空时洗入弃牌堆，与 MultiplayerGame/SinglePlayerGame 一致）
function drawCards(player: PlayerState, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (player.hand.length >= DRAW_HAND_LIMIT) {
      break;
    }
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = [...player.discard].sort(() => Math.random() - 0.5);
      player.discard = [];
    }
    const card = player.deck.pop();
    if (card) {
      player.hand.push(card);
      drawn++;
    }
  }
  return drawn;
}

// ============================================
// 生命2 妖怪效果
// ============================================

// 招福达摩 - 无效果（初始卡）
registerEffect('招福达摩', async () => {
  return { success: true, message: '招福达摩：无御魂效果' };
});

// 唐纸伞妖 - 伤害+1，查看牌库顶牌，可超度
registerEffect('唐纸伞妖', async (ctx) => {
  const { player, onChoice } = ctx;
  player.damage += 1;
  
  if (player.deck.length > 0) {
    const topCard = player.deck[player.deck.length - 1]!;
    
    let choice: number;
    if (onChoice) {
      choice = await onChoice(['保留', '超度']);
    } else {
      choice = aiDecide_唐纸伞妖(topCard);
    }
    
    if (choice === 1) {
      player.exiled.push(player.deck.pop()!);
      return { success: true, message: `唐纸伞妖：伤害+1，超度${topCard.name}`, damage: 1 };
    }
  }
  
  return { success: true, message: '唐纸伞妖：伤害+1，保留牌库顶', damage: 1 };
});

/** 唐纸伞妖 AI 决策（L1 规则策略） */
export function aiDecide_唐纸伞妖(topCard: CardInstance): number {
  if (topCard.name === '招福达摩' || topCard.cardType === 'penalty') {
    return 1; // 超度低价值/负面牌
  }
  return 0; // 保留有价值的牌
}

// 天邪鬼绿 - 退治1个生命≤4的游荡妖怪
registerEffect('天邪鬼绿', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  const validTargets = gameState.field.yokaiSlots
    .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= 4);
  
  if (validTargets.length === 0) {
    return { success: true, message: '天邪鬼绿：场上没有符合条件的妖怪' };
  }
  
  const targetId = onSelectTarget
    ? await onSelectTarget(validTargets)
    : aiSelect_天邪鬼绿(validTargets);
  
  const idx = gameState.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
  if (idx !== -1) {
    const target = gameState.field.yokaiSlots[idx]!;
    gameState.field.yokaiSlots[idx] = null;
    player.discard.push(target);
    return { success: true, message: `天邪鬼绿：退治${target.name}` };
  }
  
  return { success: true, message: '天邪鬼绿：退治失败' };
});

/** 天邪鬼绿 AI 选择（L1 规则策略）：优先退治 HP 最高的合法目标 */
export function aiSelect_天邪鬼绿(targets: CardInstance[]): string {
  const sorted = [...targets].sort((a, b) => (b.hp || 0) - (a.hp || 0));
  return sorted[0]!.instanceId;
}

// 天邪鬼青 - 选择：抓牌+1 或 伤害+1（牌库与弃牌堆皆空时仅能伤害+1，不弹出抓牌选项）
registerEffect('天邪鬼青', async (ctx) => {
  const { player, onChoice } = ctx;
  const canDraw = (player.deck?.length ?? 0) > 0 || (player.discard?.length ?? 0) > 0;
  let choice: number;
  if (!canDraw) {
    choice = 1;
  } else if (onChoice) {
    choice = await onChoice(['抓牌+1', '伤害+1']);
  } else {
    choice = 0;
  }

  if (choice === 0 && canDraw) {
    const drawn = drawCards(player, 1);
    return { success: true, message: '天邪鬼青：抓牌+1', draw: drawn };
  }
  player.damage += 1;
  return { success: true, message: '天邪鬼青：伤害+1', damage: 1 };
});

/**
 * 天邪鬼赤 AI 决策函数
 * @param hand 当前手牌
 * @returns 应弃置的卡牌 instanceId 数组（按价值升序排列后全选，即"尽可能多弃低价值牌"）
 * @description
 * - 排序规则：HP 升序 → 同 HP 按声誉升序
 * - 策略：全弃（将手牌全部换掉以滤牌），除非手牌仅 1 张且为高价值（HP≥5 或 声誉≥2）
 */
export function aiDecide_天邪鬼赤(hand: CardInstance[]): string[] {
  if (hand.length === 0) return [];
  
  // 对手牌按价值升序排序（HP升序，同HP按声誉升序）
  const sorted = [...hand].sort((a, b) => {
    const hpA = a.hp ?? 0;
    const hpB = b.hp ?? 0;
    if (hpA !== hpB) return hpA - hpB;
    const charmA = a.charm ?? 0;
    const charmB = b.charm ?? 0;
    return charmA - charmB;
  });
  
  // 如果只有1张牌且是高价值（HP≥5 或 声誉≥2），不弃
  if (sorted.length === 1) {
    const card = sorted[0]!;
    const hp = card.hp ?? 0;
    const charm = card.charm ?? 0;
    if (hp >= 5 || charm >= 2) {
      return [];
    }
  }
  
  // 否则弃置全部低价值牌（即所有牌）以最大化滤牌效果
  return sorted.map(c => c.instanceId);
}

// 天邪鬼赤 - 伤害+1，弃置任意手牌，抓等量牌
registerEffect('天邪鬼赤', async (ctx) => {
  const { player, onSelectCards } = ctx;
  player.damage += 1;
  
  if (player.hand.length > 0) {
    let ids: string[];
    
    if (onSelectCards) {
      ids = await onSelectCards(player.hand, player.hand.length);
    } else {
      // AI 接管：按价值选择弃牌
      ids = aiDecide_天邪鬼赤(player.hand);
    }
    
    const discardCount = ids.length;
    
    if (discardCount > 0) {
      for (const id of ids) {
        const idx = player.hand.findIndex(c => c.instanceId === id);
        if (idx !== -1) {
          player.discard.push(player.hand.splice(idx, 1)[0]!);
        }
      }
      
      drawCards(player, discardCount);
      return { success: true, message: `天邪鬼赤：伤害+1，换${discardCount}张牌`, damage: 1, draw: discardCount };
    }
  }
  
  return { success: true, message: '天邪鬼赤：伤害+1', damage: 1 };
});

/**
 * 天邪鬼黄 AI 决策函数
 * @param hand 当前手牌
 * @returns 应置顶的卡牌 instanceId（选择价值最低的牌）
 * @description
 * - 排序规则：HP 升序 → 同 HP 按声誉升序
 * - 选择价值最低的一张牌置顶（减少损失，且近期会再抽到）
 */
export function aiDecide_天邪鬼黄(hand: CardInstance[]): string {
  if (hand.length === 0) return '';
  
  // 对手牌按价值升序排序（HP升序，同HP按声誉升序）
  const sorted = [...hand].sort((a, b) => {
    const hpA = a.hp ?? 0;
    const hpB = b.hp ?? 0;
    if (hpA !== hpB) return hpA - hpB;
    const charmA = a.charm ?? 0;
    const charmB = b.charm ?? 0;
    return charmA - charmB;
  });
  
  // 返回价值最低的牌
  return sorted[0]!.instanceId;
}

// 天邪鬼黄 - 抓牌+2，将1张手牌放牌库顶
registerEffect('天邪鬼黄', async (ctx) => {
  const { player, onSelectCards } = ctx;
  drawCards(player, 2);
  
  if (player.hand.length > 0) {
    let cardId: string;
    if (onSelectCards) {
      const ids = await onSelectCards(player.hand, 1);
      cardId = ids[0]!;
    } else {
      // AI 接管：选择价值最低的牌置顶
      cardId = aiDecide_天邪鬼黄(player.hand);
    }
    
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      player.deck.push(player.hand.splice(idx, 1)[0]!);
    }
  }
  
  return { success: true, message: '天邪鬼黄：抓牌+2，置顶1张', draw: 2 };
});

// 赤舌 - [妨害] 对手从弃牌堆选基础术式或达摩置于牌库顶
registerEffect('赤舌', async (ctx) => {
  const { player, gameState } = ctx;
  const opponents = gameState.players.filter(p => p.id !== player.id);
  
  if (opponents.length === 0) {
    return { success: true, message: '[妨害] 赤舌：无对手，效果跳过' };
  }
  
  let affected = 0;
  for (const opp of opponents) {
    const validCards = opp.discard.filter(c =>
      c.name === '基础术式' || c.name === '招福达摩'
    );
    if (validCards.length === 0) continue;
    
    const selected = validCards.length === 1
      ? validCards[0]!
      : validCards.find(c => c.name === '招福达摩') ?? validCards[0]!;
    
    const idx = opp.discard.findIndex(c => c.instanceId === selected.instanceId);
    if (idx !== -1) {
      const movedCard = opp.discard.splice(idx, 1)[0]!;
      opp.deck.push(movedCard);
      affected++;
      
      // 标记牌顶卡牌为可见（对手可以查看自己牌顶的这张牌）
      if (!opp.revealedDeckCards) opp.revealedDeckCards = [];
      opp.revealedDeckCards.push({
        instanceId: movedCard.instanceId,
        position: 'top',
        revealedBy: opp.id, // 对手自己可见
        revealedAt: Date.now()
      });
    }
  }
  
  return {
    success: true,
    message: affected > 0
      ? `[妨害] 赤舌：${affected}名对手将弃牌堆卡牌置于牌库顶`
      : '[妨害] 赤舌：对手弃牌堆无符合条件的牌'
  };
});

// ============================================
// 生命3 妖怪效果
// ============================================

// 灯笼鬼 - 鬼火+1，抓牌+1
registerEffect('灯笼鬼', async (ctx) => {
  const { player } = ctx;
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  drawCards(player, 1);
  return { success: true, message: '灯笼鬼：鬼火+1，抓牌+1', ghostFire: 1, draw: 1 };
});

// 树妖 - 抓牌+2，弃置1张手牌
registerEffect('树妖', async (ctx) => {
  const { player, onSelectCards } = ctx;
  drawCards(player, 2);
  
  if (player.hand.length > 0) {
    let cardId: string;
    if (onSelectCards) {
      const ids = await onSelectCards(player.hand, 1);
      cardId = ids[0]!;
    } else {
      cardId = player.hand[0]!.instanceId;
    }
    
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      player.discard.push(player.hand.splice(idx, 1)[0]!);
    }
  }
  
  return { success: true, message: '树妖：抓牌+2，弃置1张', draw: 2 };
});

// 日女巳时 - 选择：鬼火+1 / 抓牌+2 / 伤害+2
// 鬼火满时不提供「鬼火+1」选项
registerEffect('日女巳时', async (ctx) => {
  const { player, onChoice } = ctx;
  
  // 构建可用选项列表
  const options: string[] = [];
  const ghostFireAvailable = player.ghostFire < player.maxGhostFire;
  
  if (ghostFireAvailable) {
    options.push('鬼火+1');
  }
  options.push('抓牌+2', '伤害+2');
  
  // 获取选择（无回调时默认第0项）
  const choiceIndex = onChoice ? await onChoice(options) : 0;
  const chosenOption = options[choiceIndex];
  
  // 根据选择执行效果
  switch (chosenOption) {
    case '鬼火+1':
      player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
      return { success: true, message: '日女巳时：鬼火+1', ghostFire: 1 };
    case '抓牌+2':
      drawCards(player, 2);
      return { success: true, message: '日女巳时：抓牌+2', draw: 2 };
    case '伤害+2':
      player.damage += 2;
      return { success: true, message: '日女巳时：伤害+2', damage: 2 };
    default:
      return { success: false, message: '无效选择' };
  }
});

// 蚌精 - 超度1张手牌，抓牌+2
registerEffect('蚌精', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  if (player.hand.length === 0) {
    return { success: false, message: '蚌精：没有手牌可超度' };
  }
  
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, 1);
    cardId = ids[0]!;
  } else {
    cardId = player.hand[0]!.instanceId;
  }
  
  const idx = player.hand.findIndex(c => c.instanceId === cardId);
  if (idx !== -1) {
    player.exiled.push(player.hand.splice(idx, 1)[0]!);
  }
  
  drawCards(player, 2);
  return { success: true, message: '蚌精：超度1张手牌，抓牌+2', draw: 2 };
});

// 鸣屋 - 弃牌堆空则伤害+4，否则伤害+2
registerEffect('鸣屋', async (ctx) => {
  const { player } = ctx;
  const damage = player.discard.length === 0 ? 4 : 2;
  player.damage += damage;
  return { success: true, message: `鸣屋：伤害+${damage}`, damage };
});

// 蝠翼 - 抓牌+1，伤害+1
registerEffect('蝠翼', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  player.damage += 1;
  return { success: true, message: '蝠翼：抓牌+1，伤害+1', draw: 1, damage: 1 };
});

// 兵主部 - 伤害+2
registerEffect('兵主部', async (ctx) => {
  const { player } = ctx;
  player.damage += 2;
  return { success: true, message: '兵主部：伤害+2', damage: 2 };
});

/**
 * 魅妖 AI 决策函数
 * @param validCards 合法展示牌列表
 * @returns 应选择的卡牌 instanceId
 * @description
 * - 优先选择能造成更高伤害的牌（damage 字段）
 * - 否则选第一张
 */
export function aiDecide_魅妖(validCards: CardInstance[]): string {
  if (validCards.length === 0) return '';
  
  // 按伤害值降序排列
  const sorted = [...validCards].sort((a, b) => {
    const dmgA = a.damage ?? 0;
    const dmgB = b.damage ?? 0;
    return dmgB - dmgA;
  });
  
  return sorted[0]!.instanceId;
}

// 魅妖 - [妨害] 对手展示牌库顶，选择生命<5的牌使用效果
registerEffect('魅妖', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  const opponents = gameState.players.filter(p => p.id !== player.id);
  
  if (opponents.length === 0) {
    return { success: true, message: '[妨害] 魅妖：无对手，跳过' };
  }
  
  // 收集所有对手牌库顶的合法牌（HP < 5）
  const validCards: CardInstance[] = [];
  const cardOwnerMap = new Map<string, PlayerState>(); // instanceId -> owner
  
  for (const opp of opponents) {
    if (opp.deck.length > 0) {
      const topCard = opp.deck[opp.deck.length - 1]!;
      if ((topCard.hp ?? 0) < 5) {
        validCards.push(topCard);
        cardOwnerMap.set(topCard.instanceId, opp);
      }
    }
  }
  
  if (validCards.length === 0) {
    return { success: true, message: '[妨害] 魅妖：没有符合条件的牌' };
  }
  
  // 选择一张牌
  let selectedCardId: string;
  if (onSelectTarget) {
    selectedCardId = await onSelectTarget(validCards);
  } else {
    // AI 接管：优先选伤害高的牌
    selectedCardId = aiDecide_魅妖(validCards);
  }
  
  const selectedCard = validCards.find(c => c.instanceId === selectedCardId);
  if (!selectedCard) {
    return { success: true, message: '[妨害] 魅妖：未选择有效牌' };
  }
  
  const owner = cardOwnerMap.get(selectedCardId)!;
  
  // 执行该牌的效果（使用效果引擎）
  let effectMessage = '';
  if (selectedCard.cardType === 'yokai' && selectedCard.name) {
    // 尝试执行御魂效果
    const effectResult = await executeYokaiEffect(selectedCard.name, {
      ...ctx,
      card: selectedCard
    });
    effectMessage = effectResult.message || '';
  }
  
  // 将牌从牌库移入拥有者弃牌区
  const idx = owner.deck.findIndex(c => c.instanceId === selectedCardId);
  if (idx !== -1) {
    owner.discard.push(owner.deck.splice(idx, 1)[0]!);
  }
  
  return { 
    success: true, 
    message: `[妨害] 魅妖：使用${selectedCard.name}的效果${effectMessage ? '（' + effectMessage + '）' : ''}` 
  };
});

// ============================================
// 生命4 妖怪效果
// ============================================

// 骰子鬼 - 超度1张手牌，退治生命不高于超度牌+2的妖怪
registerEffect('骰子鬼', async (ctx) => {
  const { player, gameState, onSelectCards, onSelectTarget } = ctx;
  
  if (player.hand.length === 0) {
    return { success: false, message: '骰子鬼：没有手牌可超度' };
  }
  
  // 选择超度的牌（AI策略：优先超度声誉最低的牌，同声誉时选HP最高的）
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, 1);
    cardId = ids[0]!;
  } else {
    cardId = aiDecide_骰子鬼_超度(player.hand);
  }
  
  const cardIdx = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIdx === -1) return { success: false, message: '选择的卡牌无效' };
  
  const exiledCard = player.hand.splice(cardIdx, 1)[0]!;
  player.exiled.push(exiledCard);
  const maxHp = (exiledCard.hp || 0) + 2;
  
  // 退治生命不高于maxHp的妖怪
  const validTargets = gameState.field.yokaiSlots
    .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= maxHp);
  
  if (validTargets.length === 0) {
    return { success: true, message: `骰子鬼：超度${exiledCard.name}，没有可退治的妖怪` };
  }
  
  // 选择退治目标（AI策略：优先退治声誉最高的妖怪，同声誉时选HP最高的）
  const targetId = onSelectTarget 
    ? await onSelectTarget(validTargets) 
    : aiDecide_骰子鬼_退治(validTargets);
  
  const idx = gameState.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
  if (idx !== -1) {
    const target = gameState.field.yokaiSlots[idx]!;
    gameState.field.yokaiSlots[idx] = null;
    // 退治的妖怪进入玩家弃牌堆
    player.discard.push(target);
    return { success: true, message: `骰子鬼：超度${exiledCard.name}，退治${target.name}` };
  }
  
  return { success: true, message: `骰子鬼：超度${exiledCard.name}` };
});

/**
 * 骰子鬼 AI 决策 - 选择超度手牌（L1 规则策略）
 * @param hand 可选手牌列表
 * @returns 应超度的卡牌 instanceId
 * @description
 * - 优先选择声誉最低的牌
 * - 同声誉时选择HP最高的牌（使退治范围更大）
 */
export function aiDecide_骰子鬼_超度(hand: CardInstance[]): string {
  if (hand.length === 0) return '';
  if (hand.length === 1) return hand[0]!.instanceId;
  
  // 按声誉升序，同声誉时按HP降序
  const sorted = [...hand].sort((a, b) => {
    const charmA = (a as any).charm ?? 0;
    const charmB = (b as any).charm ?? 0;
    if (charmA !== charmB) return charmA - charmB;
    return (b.hp || 0) - (a.hp || 0);
  });
  return sorted[0]!.instanceId;
}

/**
 * 骰子鬼 AI 决策 - 选择退治目标（L1 规则策略）
 * @param targets 可选游荡妖怪列表
 * @returns 应退治的妖怪 instanceId
 * @description
 * - 优先选择声誉最高的妖怪
 * - 同声誉时选择HP最高的妖怪
 */
export function aiDecide_骰子鬼_退治(targets: CardInstance[]): string {
  if (targets.length === 0) return '';
  if (targets.length === 1) return targets[0]!.instanceId;
  
  // 按声誉降序，同声誉时按HP降序
  const sorted = [...targets].sort((a, b) => {
    const charmA = (a as any).charm ?? 0;
    const charmB = (b as any).charm ?? 0;
    if (charmA !== charmB) return charmB - charmA;
    return (b.hp || 0) - (a.hp || 0);
  });
  return sorted[0]!.instanceId;
}

// 涅槃之火 - 本回合式神技能鬼火消耗-1
registerEffect('涅槃之火', async (ctx) => {
  const { player } = ctx;
  // 使用正式的 SkillCostReductionBuff 类型（定义在 TempBuff.ts）
  player.tempBuffs.push({
    type: 'SKILL_COST_REDUCTION',
    value: 1,
    source: '涅槃之火'
  });
  return { success: true, message: '涅槃之火：本回合式神技能鬼火消耗-1' };
});

/**
 * AI决策：薙魂 - 选择弃置哪张手牌
 * 策略：弃置价值最低的牌
 * - 优先保留御魂和阴阳术
 * - 优先弃置低HP的牌
 * - 若已打出2张御魂，更优先保留御魂
 * @param hand 玩家手牌
 * @param yokaiPlayedCount 本回合已打出的御魂数量（不含当前的薙魂）
 * @returns 要弃置的卡牌instanceId
 */
export function aiSelect_薙魂(hand: CardInstance[], yokaiPlayedCount: number = 0): string {
  if (hand.length === 0) return '';
  if (hand.length === 1) return hand[0]!.instanceId;
  
  // 计算每张牌的保留价值
  let lowestIndex = 0;
  let lowestValue = Infinity;
  
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    let value = card.hp ?? 0;
    
    // 阴阳术通常最重要
    if (card.cardType === 'spell') {
      value += 10;
    }
    
    // 若还没凑够3张御魂，御魂价值提高
    if (card.cardType === 'yokai') {
      if (yokaiPlayedCount < 2) {
        value += 5;  // 保留御魂以凑条件
      } else {
        value += 2;  // 已满足条件，御魂价值略高
      }
    }
    
    // 恶评卡最应该弃置
    if (card.cardType === 'penalty') {
      value = -10;
    }
    
    if (value < lowestValue) {
      lowestValue = value;
      lowestIndex = i;
    }
  }
  
  return hand[lowestIndex]!.instanceId;
}

/**
 * AI决策：雪幽魂 - 选择弃置哪张恶评
 * 策略：优先弃置声誉惩罚最低的恶评（农夫-1 优先于武士-2）
 * @param penaltyCards 对手手牌中的恶评卡
 * @returns 要弃置的卡牌instanceId，空则返回''
 */
export function aiDecide_雪幽魂(penaltyCards: CardInstance[]): string {
  if (penaltyCards.length === 0) return '';
  // 农夫(penalty_001)优先于武士(penalty_002)
  const farmer = penaltyCards.find(c => c.cardId === 'penalty_001');
  if (farmer) return farmer.instanceId;
  return penaltyCards[0]!.instanceId;
}

// 雪幽魂 - [妨害] 抓牌+1，对手弃置恶评或获得恶评
registerEffect('雪幽魂', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  
  // 1. 打出者抓牌+1
  drawCards(player, 1);
  
  // 2. 对每名对手执行妨害
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    
    // 查找对手手牌中的恶评卡
    const penaltyCards = p.hand.filter(c => c.cardType === 'penalty');
    
    if (penaltyCards.length > 0) {
      // 有恶评卡，需要弃置1张
      let cardToDiscard: CardInstance | undefined;
      
      if (penaltyCards.length === 1) {
        // 只有1张恶评，自动弃置
        cardToDiscard = penaltyCards[0];
      } else if (onSelectCards) {
        // 多张恶评，玩家选择（传入对手的恶评卡）
        const selectedIds = await onSelectCards(penaltyCards, 1);
        if (selectedIds.length > 0) {
          cardToDiscard = p.hand.find(c => c.instanceId === selectedIds[0]);
        }
      }
      
      // 若无选择或选择为空，执行AI默认策略
      if (!cardToDiscard) {
        const aiChoice = aiDecide_雪幽魂(penaltyCards);
        cardToDiscard = p.hand.find(c => c.instanceId === aiChoice);
      }
      
      // 执行弃置
      if (cardToDiscard) {
        const idx = p.hand.findIndex(c => c.instanceId === cardToDiscard!.instanceId);
        if (idx !== -1) {
          p.discard.push(p.hand.splice(idx, 1)[0]!);
        }
      }
    } else {
      // 无恶评卡，【获得】1张恶评（进入弃牌堆）
      let penaltyCard: CardInstance;
      
      if (gameState.field.penaltyPile && gameState.field.penaltyPile.length > 0) {
        // 从恶评牌库顶抽取
        penaltyCard = gameState.field.penaltyPile.pop()!;
      } else {
        // 牌库耗尽，默认获得农夫（无限供应）
        penaltyCard = {
          instanceId: `penalty_${Date.now()}_${Math.random()}`,
          cardId: 'penalty_001',
          cardType: 'penalty',
          name: '农夫',
          hp: 0,
          maxHp: 0
        };
      }
      
      // 【获得】规则：从公共牌堆获得的牌进入弃牌堆
      p.discard.push(penaltyCard);
    }
  }
  
  return { success: true, message: '[妨害] 雪幽魂：抓牌+1，对手弃置/获得恶评', draw: 1 };
});

// 轮入道 - 弃置生命≤6的御魂，执行其效果两次
registerEffect('轮入道', async (ctx) => {
  const { player, gameState, onSelectCards, onChoice, onSelectTarget } = ctx;
  
  const validCards = player.hand.filter(c => 
    c.cardType === 'yokai' && (c.hp || 0) <= 6
  );
  
  if (validCards.length === 0) {
    return { success: false, message: '轮入道：没有符合条件的御魂' };
  }
  
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(validCards, 1);
    cardId = ids[0]!;
  } else {
    cardId = validCards[0]!.instanceId;
  }
  
  const idx = player.hand.findIndex(c => c.instanceId === cardId);
  if (idx === -1) return { success: false, message: '选择的卡牌无效' };
  
  const targetCard = player.hand.splice(idx, 1)[0]!;
  player.discard.push(targetCard);
  
  // ── 【触】弃置触发：主动弃置时触发卡牌的【触】效果 ──
  triggerOnDiscard(player, targetCard);
  
  const subCtx: EffectContext = {
    player, gameState, card: targetCard,
    onSelectCards, onChoice, onSelectTarget
  };
  const r1 = await executeYokaiEffect(targetCard.name, subCtx);
  const r2 = await executeYokaiEffect(targetCard.name, subCtx);
  
  const msgs = [r1.message, r2.message].filter(Boolean).join('；');
  return { success: true, message: `轮入道：弃置${targetCard.name}，双重效果 → ${msgs}` };
});

/**
 * 轮入道AI评分函数：评估弃置某张御魂执行两次效果的收益
 * 用于AI选择最优的弃置目标
 * @param card 要评估的御魂卡牌
 * @param context AI上下文（鬼火、手牌数等）
 * @returns 评分（越高越优先选择）
 */
export function aiDecide_轮入道(card: CardInstance, context?: { ghostFire?: number; handCount?: number }): number {
  const ghostFire = context?.ghostFire ?? 3;
  const handCount = context?.handCount ?? 5;
  
  // 轮入道评分原则：
  // - 轮入道已消耗1张牌（弃置御魂），需要额外资源的牌评分应降低
  // - 无额外消耗、纯收益的牌评分更高
  // - 需要超度/弃置手牌的牌，会进一步加大资源消耗，评分较低
  
  const highValueCards: Record<string, number> = {
    // === 高收益（无额外消耗）===
    '心眼': 10,       // 纯伤害+6，无额外消耗
    '兵主部': 9,      // 纯伤害+4，无额外消耗
    '破势': 8,        // 伤害+10（首张）或+6，无额外消耗
    '涅槃之火': 8,    // 减费-2（效果叠加），无额外消耗
    '灯笼鬼': 8,      // 鬼火+2，抓牌+2，无额外消耗
    '蝠翼': 7,        // 抓牌+2，伤害+2，无额外消耗
    '镜姬': 7,        // 抓+4，伤+2，火+2，无额外消耗
    // 抓牌+1、伤害+X（X=当前鬼火）；轮入道执行两次时收益约翻倍，故用基础分+鬼火加成
    '狂骨': 6 + Math.min(ghostFire, 5),
    '日女巳时': 6,    // 选择两次，灵活组合，无额外消耗
    '鸣屋': 6,        // 伤害+4或+8，无额外消耗
    '针女': 6,        // 伤害+2，后续技能伤害+4，无额外消耗
    '返魂香': 5,      // 抓牌+2，伤害+2，妨害效果
    '雪幽魂': 5,      // 抓牌+2，妨害2次
    '天邪鬼青': 4,    // 抓牌+2或伤害+2
    '天邪鬼绿': 4,    // 退治两只，无额外消耗
    
    // === 中收益（需要弃置/超度手牌）===
    '天邪鬼黄': 4,    // 抓牌+4但要置顶2张
    '树妖': 4,        // 抓牌+4但要弃2（触发抓+2后净收益仍可观）
    '天邪鬼赤': 3,    // 伤害+2，但要弃置换牌×2
    '薙魂': 3,        // 抓+2弃2，需要已打3御魂才有鬼火收益
    '蚌精': 3,        // 超度2张手牌，抓牌+4（净亏2张牌换抓4）
    '唐纸伞妖': 3,    // 伤害+2，超度2张牌库顶（资源消耗中等）
    '青女房': 3,      // 抓牌+4，鬼火+2（但HP=8不能被选）
    
    // === 低收益（高消耗或效果有限）===
    '骰子鬼': Math.min(handCount, 4),  // 需超度手牌，手牌多时价值高
    '伤魂鸟': Math.min(handCount, 4),  // 需超度大量手牌才有高伤害
    '地藏像': 2,      // 需超度自身，获取2式神（消耗大但式神价值高）
    '网切': 2,        // 状态效果不叠加
    '三味': 2,        // 轮入道×2：实时伤害结算两次，按当时 played 计数
    '招福达摩': 0,    // 不可打出/无效果
  };
  
  return highValueCards[card.name] || 3;
}

/**
 * 为轮入道选择最优的弃置目标
 * @param validCards 可选的御魂卡牌列表
 * @param context AI上下文
 * @returns 最优选择的卡牌instanceId
 */
export function aiSelect_轮入道(
  validCards: CardInstance[], 
  context?: { ghostFire?: number; handCount?: number }
): string | null {
  if (validCards.length === 0) return null;
  
  const scored = validCards.map(card => ({
    card,
    score: aiDecide_轮入道(card, context)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.card.instanceId || null;
}

// 网切 - 本回合妖怪生命-1，鬼王生命-2（最低1）
// 设计文档: 状态存储在 gameState.field 级别（影响全局），覆盖不叠加
registerEffect('网切', async (ctx) => {
  const { gameState, player } = ctx;
  applyNetCutterFieldBuff(gameState.field, { sourcePlayerId: player.id });
  return { success: true, message: '网切：本回合所有妖怪HP-1，鬼王HP-2' };
});

// 铮 - 抓牌+1，伤害+2
registerEffect('铮', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  player.damage += 2;
  return { success: true, message: '铮：抓牌+1，伤害+2', draw: 1, damage: 2 };
});

// 薙魂 - 抓牌+1，弃置1张。本回合打出≥3张御魂（含此牌）时鬼火+2
registerEffect('薙魂', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  // 步骤1：抓牌+1
  drawCards(player, 1);
  
  // 步骤2：弃置1张手牌（必须执行）
  if (player.hand.length > 0) {
    let cardId: string;
    if (onSelectCards) {
      const ids = await onSelectCards(player.hand, 1);
      cardId = ids[0]!;
    } else {
      // 默认弃置第一张（AI策略或无回调时）
      cardId = player.hand[0]!.instanceId;
    }
    
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      const discarded = player.hand.splice(idx, 1)[0]!;
      player.discard.push(discarded);
    }
  }
  
  // 步骤3：即时检查本回合御魂数量（包括薙魂自身）
  const played = (player as any).played as CardInstance[] | undefined;
  const yokaiPlayed = played ? played.filter((c: CardInstance) => c.cardType === 'yokai').length : 0;
  
  // 步骤4：条件满足则鬼火+2
  if (yokaiPlayed >= 3) {
    const actualGain = Math.min(2, player.maxGhostFire - player.ghostFire);
    player.ghostFire = Math.min(player.ghostFire + 2, player.maxGhostFire);
    if (actualGain > 0) {
      return { success: true, message: `薙魂：抓牌+1，弃1牌，已打出${yokaiPlayed}张御魂→鬼火+${actualGain}`, draw: 1, ghostFire: actualGain };
    } else {
      return { success: true, message: `薙魂：抓牌+1，弃1牌，已打出${yokaiPlayed}张御魂（鬼火已满）`, draw: 1 };
    }
  }
  
  return { success: true, message: `薙魂：抓牌+1，弃1牌（本回合${yokaiPlayed}张御魂）`, draw: 1 };
});

// 魍魉之匣 - 抓牌+1，伤害+1，所有玩家展示牌库顶
registerEffect('魍魉之匣', async (ctx) => {
  const { player, gameState, onChoice } = ctx;
  drawCards(player, 1);
  player.damage += 1;
  
  // 所有玩家展示牌库顶，由你决定保留或弃置
  for (const p of gameState.players) {
    if (p.deck.length > 0) {
      const choice = onChoice ? await onChoice([`保留${p.name}的牌`, `弃置${p.name}的牌`]) : 0;
      if (choice === 1) {
        p.discard.push(p.deck.pop()!);
      }
    }
  }
  
  return { success: true, message: '[妨害] 魍魉之匣：抓牌+1，伤害+1', draw: 1, damage: 1 };
});

// ============================================
// 生命5 妖怪效果
// ============================================

// 狂骨 - 抓牌+1，伤害+X（X=打出瞬间当前鬼火；先于抓牌锁定，与策划文档一致）
registerEffect('狂骨', async (ctx) => {
  const { player } = ctx;
  const damage = player.ghostFire;
  drawCards(player, 1);
  player.damage += damage;
  return { success: true, message: `狂骨：抓牌+1，伤害+${damage}`, draw: 1, damage };
});

// 返魂香 - [妨害] 抓牌+1，伤害+1，每名对手选择：弃置1张手牌或获得1张恶评
registerEffect('返魂香', async (ctx) => {
  const { player, gameState, onChoice } = ctx;
  drawCards(player, 1);
  player.damage += 1;
  
  // 遍历每名对手
  for (const opponent of gameState.players) {
    if (opponent.id === player.id) continue;
    
    // 检查对手是否有手牌
    const hasHandCards = opponent.hand.length > 0;
    
    if (!hasHandCards) {
      // 无手牌，直接获得恶评
      givePenaltyCard(opponent, gameState);
      continue;
    }
    
    // 有手牌，让对手选择
    let choice = 0; // 默认弃牌
    if (onChoice) {
      // 请求对手选择
      choice = await onChoice({
        type: 'fanHunXiangChoice',
        playerId: opponent.id,
        prompt: '返魂香：选择一项',
        options: ['弃置1张手牌', '获得1张恶评']
      });
    }
    
    if (choice === 0) {
      // 弃置1张手牌（AI策略：弃置价值最低的牌）
      const sortedHand = [...opponent.hand].sort((a, b) => (a.hp || 0) - (b.hp || 0));
      const cardToDiscard = sortedHand[0]!;
      const idx = opponent.hand.findIndex(c => c.instanceId === cardToDiscard.instanceId);
      if (idx !== -1) {
        opponent.discard.push(opponent.hand.splice(idx, 1)[0]!);
      }
    } else {
      // 获得恶评
      givePenaltyCard(opponent, gameState);
    }
  }
  
  return { success: true, message: '[妨害] 返魂香：抓牌+1，伤害+1', draw: 1, damage: 1 };
});

/** 给玩家发放恶评牌（进入弃牌堆） */
function givePenaltyCard(player: PlayerState, gameState: GameState): void {
  let penaltyCard: CardInstance;
  
  // 尝试从恶评牌堆获取
  if (gameState.field.penaltyPile && gameState.field.penaltyPile.length > 0) {
    penaltyCard = gameState.field.penaltyPile.pop()!;
  } else {
    // 牌堆耗尽，创建农夫（无限供应）
    penaltyCard = {
      instanceId: `penalty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cardId: 'penalty_001',
      cardType: 'penalty',
      name: '农夫',
      charm: -1,
      hp: 1,
      maxHp: 1
    };
  }
  
  // 【获得】规则：从公共牌堆获得的牌进入弃牌堆
  player.discard.push(penaltyCard);
}

// 镇墓兽 - 鬼火+1，抓牌+1，伤害+2，左手边玩家指定禁止退治目标
// 完整交互效果在 MultiplayerGame.executeYokaiEffectByName 中实现
// 此处仅处理单人模式/测试的基础效果
registerEffect('镇墓兽', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  
  // 1. 鬼火+1（不超过上限）
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  
  // 2. 抓牌+1
  drawCards(player, 1);
  
  // 3. 伤害+2
  player.damage += 2;
  
  // 4. 左手边玩家选择禁止退治目标（在单人模式下由 AI 代选）
  // 收集所有可选目标（游荡妖怪 + 鬼王）
  const validTargets: CardInstance[] = [];
  
  // 添加游荡区妖怪
  if (gameState.field?.yokaiSlots) {
    for (const yokai of gameState.field.yokaiSlots) {
      if (yokai && yokai.instanceId) {
        validTargets.push(yokai);
      }
    }
  }
  
  // 添加鬼王
  const boss = gameState.field?.currentBoss || gameState.field?.boss;
  if (boss && boss.instanceId) {
    validTargets.push(boss as CardInstance);
  }
  
  // 如果有可选目标，进行选择
  if (validTargets.length > 0 && onSelectTarget) {
    // 单人模式：AI 选择（选择 HP 最低的目标）
    const targetId = await onSelectTarget(validTargets);
    if (targetId) {
      // 记录禁止退治目标
      if (!player.prohibitedTargets) {
        player.prohibitedTargets = [];
      }
      player.prohibitedTargets.push(targetId);
    }
  } else if (validTargets.length > 0) {
    // 没有选择回调时，AI 自动选择 HP 最低的目标
    const sortedTargets = [...validTargets].sort((a, b) => (a.hp || 0) - (b.hp || 0));
    const selectedTarget = sortedTargets[0];
    if (!player.prohibitedTargets) {
      player.prohibitedTargets = [];
    }
    player.prohibitedTargets.push(selectedTarget.instanceId);
  }
  
  return { success: true, message: '镇墓兽：鬼火+1，抓牌+1，伤害+2', ghostFire: 1, draw: 1, damage: 2 };
});

// 针女 - 伤害+1，本回合使用式神技能时伤害+2
registerEffect('针女', async (ctx) => {
  const { player } = ctx;
  player.damage += 1;
  player.tempBuffs.push({
    type: 'SKILL_DAMAGE_BONUS' as any,
    value: 2,
    duration: 1,
    source: '针女'
  } as any);
  return { success: true, message: '针女：伤害+1，本回合技能伤害+2', damage: 1 };
});

// 心眼 - 伤害+3
registerEffect('心眼', async (ctx) => {
  const { player } = ctx;
  player.damage += 3;
  return { success: true, message: '心眼：伤害+3', damage: 3 };
});

// 涂佛 - 从弃牌区选择3张阴阳术置入手牌
registerEffect('涂佛', async (ctx) => {
  const { player, onSelectCards } = ctx;
  const spells = player.discard.filter(c => c.cardType === 'spell');
  
  if (spells.length === 0) {
    return { success: true, message: '涂佛：弃牌区没有阴阳术' };
  }
  
  const count = Math.min(3, spells.length);
  let selectedIds: string[];
  
  if (onSelectCards) {
    selectedIds = await onSelectCards(spells, count);
  } else {
    selectedIds = spells.slice(0, count).map(c => c.instanceId);
  }
  
  for (const id of selectedIds) {
    const idx = player.discard.findIndex(c => c.instanceId === id);
    if (idx !== -1) {
      player.hand.push(player.discard.splice(idx, 1)[0]!);
    }
  }
  
  return { success: true, message: `涂佛：从弃牌区取回${selectedIds.length}张阴阳术` };
});

// 地藏像 - 超度此牌，获取1个式神
// 注意：地藏像的核心逻辑在 MultiplayerGame 中实现，因为需要：
// 1. 二次确认（打出前）
// 2. 式神二选一（从式神牌库抽取）
// 3. 式神置换（满3个时）
// 这里只做共享层的占位和基础标记
registerEffect('地藏像', async (ctx) => {
  const { player, card, addLog } = ctx;
  
  // 超度此牌（从已打出区移入超度区）
  // 注意：在服务端流程中，牌会先进入 played 区，然后这里移动到 exiled
  const playedIdx = player.played.findIndex(c => c.instanceId === card.instanceId);
  if (playedIdx !== -1) {
    player.played.splice(playedIdx, 1);
  }
  player.exiled.push(card);
  
  addLog?.(`🙏 地藏像被超度`);
  
  // 式神获取的完整逻辑由 MultiplayerGame.executeYokaiEffectByName 处理
  // 返回标记，告知服务端需要继续处理式神获取流程
  return { 
    success: true, 
    message: '地藏像：超度此牌，获取1个式神',
    needShikigamiAcquire: true  // 标记需要式神获取流程
  };
});

// ============================================
// 生命6 妖怪效果
// ============================================

// 飞缘魔 - 使用当前鬼王的御魂效果
registerEffect('飞缘魔', async (ctx) => {
  const { player, gameState, onSelectCards, onChoice } = ctx;
  const boss = (gameState.field as any).currentBoss ?? (gameState.field as any).boss ?? (gameState.field as any).bossSlot;
  
  if (!boss) {
    return { success: true, message: '飞缘魔：场上没有鬼王' };
  }
  
  try {
    const { executeBossSoul } = await import('./BossEffects');
    const bossResult = await executeBossSoul(boss.name, {
      gameState: gameState as any,
      bossCard: boss,
      player: player as any,
      onSelectCards, onChoice
    });
    return { success: true, message: `飞缘魔：使用鬼王【${boss.name}】御魂效果 → ${bossResult.message}` };
  } catch {
    return { success: true, message: `飞缘魔：使用${boss.name}的效果（引擎未连接）` };
  }
});

// 破势 - 伤害+3，首张牌时伤害+5
registerEffect('破势', async (ctx) => {
  const { player } = ctx;
  const playedCount = (player as any).cardsPlayed ?? (player as any).played?.length ?? 0;
  const isFirst = playedCount <= 1;
  
  const damage = isFirst ? 5 : 3;
  player.damage += damage;
  
  return { success: true, message: `破势：伤害+${damage}（${isFirst ? '首张' : '非首张'}）`, damage };
});

// 镜姬 - 抓牌+2，伤害+1，鬼火+1
registerEffect('镜姬', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 2);
  player.damage += 1;
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  return { success: true, message: '镜姬：抓牌+2，伤害+1，鬼火+1', draw: 2, damage: 1, ghostFire: 1 };
});

// 木魅 - 展示牌库顶直到出现3张阴阳术
registerEffect('木魅', async (ctx) => {
  const { player, addLog } = ctx;
  const revealed: CardInstance[] = [];
  const spells: CardInstance[] = [];
  
  // 从牌库顶（shift）开始展示，直到找到3张阴阳术或牌库空
  while (player.deck.length > 0 && spells.length < 3) {
    const card = player.deck.shift()!;
    revealed.push(card);
    
    if (card.cardType === 'spell') {
      spells.push(card);
      addLog?.(`📖 展示: ${card.name} (阴阳术 ${spells.length}/3)`);
    } else {
      addLog?.(`📖 展示: ${card.name}`);
    }
  }
  
  // 阴阳术置入手牌
  for (const spell of spells) {
    player.hand.push(spell);
  }
  
  // 其余弃置（非阴阳术的展示牌）
  const discarded: CardInstance[] = [];
  for (const card of revealed) {
    if (!spells.includes(card)) {
      player.discard.push(card);
      discarded.push(card);
    }
  }
  
  const spellNames = spells.map(c => c.name).join('、') || '无';
  const discardNames = discarded.map(c => c.name).join('、') || '无';
  addLog?.(`🎴 木魅 → 获得${spells.length}张阴阳术: [${spellNames}]，弃置${discarded.length}张: [${discardNames}]`);
  
  return { success: true, message: `木魅：获得${spells.length}张阴阳术`, draw: spells.length };
});

// ============================================
// 生命7 妖怪效果
// ============================================

// 幽谷响 - [妨害] 每名对手展示牌库顶牌，选至多3张非鬼王使用其效果
registerEffect('幽谷响', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  const opponents = gameState.players.filter(p => p.id !== player.id);
  
  if (opponents.length === 0) {
    return { success: true, message: '[妨害] 幽谷响：无对手，跳过' };
  }
  
  // 1. 收集所有对手的牌库顶牌
  const revealedCards: { card: CardInstance; owner: PlayerState }[] = [];
  for (const opp of opponents) {
    if (opp.deck.length > 0) {
      // 牌库顶是数组最后一个元素
      const topCard = opp.deck[opp.deck.length - 1]!;
      revealedCards.push({ card: topCard, owner: opp });
    }
  }
  
  if (revealedCards.length === 0) {
    return { success: true, message: '[妨害] 幽谷响：所有对手牌库为空' };
  }
  
  // 2. 筛选非鬼王的可选牌
  const selectableCards = revealedCards.filter(r => r.card.cardType !== 'boss');
  const bossCards = revealedCards.filter(r => r.card.cardType === 'boss');
  
  // 3. 选择使用哪些牌（0~3张）
  let selectedIds: string[] = [];
  const maxSelect = Math.min(3, selectableCards.length);
  
  if (selectableCards.length > 0) {
    if (onSelectCards) {
      // 玩家选择
      selectedIds = await onSelectCards(
        selectableCards.map(r => r.card),
        maxSelect
      );
    } else {
      // AI 策略：按效果价值评分选择
      selectedIds = aiDecide_幽谷响(selectableCards.map(r => r.card), maxSelect);
    }
  }
  
  // 4. 执行所选牌的效果
  const usedNames: string[] = [];
  for (const cardId of selectedIds) {
    const revealed = selectableCards.find(r => r.card.instanceId === cardId);
    if (!revealed) continue;
    
    const selectedCard = revealed.card;
    
    // 执行该牌的御魂效果（归属于幽谷响使用者）
    if (selectedCard.cardType === 'yokai' && selectedCard.name) {
      await executeYokaiEffect(selectedCard.name, {
        ...ctx,
        card: selectedCard
      });
      usedNames.push(selectedCard.name);
    }
  }
  
  // 5. 所有展示的牌归还各自拥有者的弃牌区
  for (const { card, owner } of revealedCards) {
    const idx = owner.deck.findIndex(c => c.instanceId === card.instanceId);
    if (idx !== -1) {
      owner.discard.push(owner.deck.splice(idx, 1)[0]!);
    }
  }
  
  // 生成日志消息
  const allNames = revealedCards.map(r => r.card.name).join('、');
  const bossInfo = bossCards.length > 0 
    ? `（${bossCards.map(r => r.card.name).join('、')}为鬼王不可选）` 
    : '';
  const usedInfo = usedNames.length > 0 
    ? `使用了 [${usedNames.join('、')}] 的效果` 
    : '未使用任何效果';
  
  return { 
    success: true, 
    message: `[妨害] 幽谷响：展示了 [${allNames}]${bossInfo}，${usedInfo}` 
  };
});

// 幽谷响 AI 决策：按效果价值评分选择前 N 张
function aiDecide_幽谷响(cards: CardInstance[], maxCount: number): string[] {
  // 评分函数
  const scoreCard = (card: CardInstance): number => {
    let score = 0;
    // 伤害类：伤害值 × 2
    if (card.damage && card.damage > 0) {
      score += card.damage * 2;
    }
    // 根据卡牌名称判断效果类型（简化处理）
    const name = card.name || '';
    // 抓牌类
    if (name.includes('灯笼鬼') || name.includes('天邪鬼青')) {
      score += 3; // 抓牌+1 × 1.5 ≈ 3
    }
    if (name.includes('树妖')) {
      score += 4; // 抓牌+2 × 1.5 ≈ 4（需弃牌，略降）
    }
    // 鬼火类
    if (name.includes('蝠翼') || name.includes('鸣屋')) {
      score += 1; // 鬼火+1
    }
    // 声誉类（对己方收益低）
    if (name.includes('达摩') || name.includes('蚌精')) {
      score += 0.5;
    }
    // 妨害类对自己无益或有害
    if (name.includes('雪幽魂') || name.includes('魍魉')) {
      score = 0;
    }
    // 恶评卡有害
    if (card.cardType === 'penalty') {
      score = -10;
    }
    // 令牌通常无效果
    if (card.cardType === 'token') {
      score = -5;
    }
    return score;
  };
  
  // 按评分排序
  const scored = cards.map(c => ({ card: c, score: scoreCard(c) }));
  scored.sort((a, b) => b.score - a.score);
  
  // 选择评分>0的前 maxCount 张
  const selected: string[] = [];
  for (const { card, score } of scored) {
    if (score > 0 && selected.length < maxCount) {
      selected.push(card.instanceId);
    }
  }
  
  return selected;
}

/**
 * 伤魂鸟 AI 决策函数
 * @param hand 当前手牌列表
 * @param targetHp 目标妖怪 HP（可选，用于计算伤害缺口）
 * @param currentDamage 当前伤害（可选）
 * @returns 应超度的卡牌 instanceId 列表
 * @description
 * L1 规则策略：
 * - 优先超度：恶评卡 > HP≤3的妖怪 > 阴阳术 > 其他
 * - 根据伤害缺口决定超度数量（若目标明确）
 * - 若无明确目标，默认超度低价值牌
 */
export function aiDecide_伤魂鸟(
  hand: CardInstance[],
  targetHp?: number,
  currentDamage?: number
): string[] {
  if (hand.length === 0) return [];
  
  // 计算伤害缺口
  const damageGap = (targetHp ?? 0) - (currentDamage ?? 0);
  const neededExileCount = damageGap > 0 ? Math.ceil(damageGap / 2) : 0;
  
  // 按超度优先级排序（低价值优先超度）
  const prioritized = [...hand].sort((a, b) => {
    // 恶评卡优先超度（cardType === 'penalty'）
    const isPenaltyA = a.cardType === 'penalty' ? 1 : 0;
    const isPenaltyB = b.cardType === 'penalty' ? 1 : 0;
    if (isPenaltyA !== isPenaltyB) return isPenaltyB - isPenaltyA;
    
    // HP≤3 的妖怪次之
    const hpA = a.hp ?? 0;
    const hpB = b.hp ?? 0;
    if (hpA <= 3 && hpB > 3) return -1;
    if (hpB <= 3 && hpA > 3) return 1;
    
    // 同 HP 区间按 HP 升序（更低 HP 优先超度）
    if (hpA !== hpB) return hpA - hpB;
    
    // 同 HP 按声誉升序（更低声誉优先超度）
    const charmA = a.charm ?? 0;
    const charmB = b.charm ?? 0;
    return charmA - charmB;
  });
  
  // 如果有伤害缺口，超度足够数量的牌
  if (neededExileCount > 0) {
    const exileCount = Math.min(neededExileCount, hand.length);
    return prioritized.slice(0, exileCount).map(c => c.instanceId);
  }
  
  // 无伤害需求时，只超度恶评卡
  const penaltyCards = prioritized.filter(c => c.cardType === 'penalty');
  return penaltyCards.map(c => c.instanceId);
}

// 伤魂鸟 - 超度X张手牌，伤害+2X
registerEffect('伤魂鸟', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  // 边界：打出后手牌为空
  if (player.hand.length === 0) {
    return { success: true, message: '伤魂鸟：没有手牌可超度，伤害+0' };
  }
  
  let selectedIds: string[];
  if (onSelectCards) {
    // 玩家选择：传入手牌，允许选 0~全部
    selectedIds = await onSelectCards(player.hand, player.hand.length);
  } else {
    // AI 接管：使用 L1 策略
    selectedIds = aiDecide_伤魂鸟(player.hand);
  }
  
  // 执行超度
  for (const id of selectedIds) {
    const idx = player.hand.findIndex(c => c.instanceId === id);
    if (idx !== -1) {
      player.exiled.push(player.hand.splice(idx, 1)[0]!);
    }
  }
  
  // 计算伤害
  const damage = selectedIds.length * 2;
  player.damage += damage;
  
  if (selectedIds.length === 0) {
    return { success: true, message: '伤魂鸟：未超度任何牌，伤害+0' };
  }
  
  return { success: true, message: `伤魂鸟：超度${selectedIds.length}张，伤害+${damage}`, damage };
});

// 阴摩罗 - 选择弃牌区2张生命<6的牌使用，回合结束返回牌库底
// 注意：服务端实现中使用 pendingEndOfTurnEffects 队列在回合结束时归还
registerEffect('阴摩罗', async (ctx) => {
  const { player, gameState, onSelectCards, onChoice, onSelectTarget } = ctx;
  const validCards = player.discard.filter(c => (c.hp || 0) < 6);
  
  if (validCards.length === 0) {
    return { success: true, message: '阴摩罗：弃牌区没有符合条件的牌' };
  }
  
  const count = Math.min(2, validCards.length);
  let selectedIds: string[];
  
  if (onSelectCards) {
    selectedIds = await onSelectCards(validCards, count);
  } else {
    // AI/默认策略：按效果价值选择（伤害>抓牌>鬼火）
    selectedIds = aiDecide_阴摩罗(validCards, count);
  }
  
  const usedCards: CardInstance[] = [];
  const effectMsgs: string[] = [];
  
  for (const id of selectedIds) {
    const idx = player.discard.findIndex(c => c.instanceId === id);
    if (idx !== -1) {
      const card = player.discard.splice(idx, 1)[0]!;
      usedCards.push(card);
      
      if (card.cardType === 'yokai' && card.name) {
        const subCtx: EffectContext = {
          player, gameState, card,
          onSelectCards, onChoice, onSelectTarget
        };
        const r = await executeYokaiEffect(card.name, subCtx);
        if (r.success) effectMsgs.push(`${card.name}: ${r.message}`);
      }
    }
  }
  
  // 标记待归还的牌（服务端会在回合结束时处理）
  // 共享层测试中直接放入牌库底（简化处理）
  for (const card of usedCards) {
    player.deck.push(card); // 放入牌库底部（push 而不是 unshift）
  }
  
  return {
    success: true,
    message: `阴摩罗：使用${usedCards.map(c => c.name).join('、')}的效果`,
    usedCards // 返回使用的牌，供服务端注册回合结束归还
  };
});

/**
 * 阴摩罗 AI 选牌策略
 * 按效果价值排序选择：伤害类 > 抓牌类 > 鬼火类
 */
export function aiDecide_阴摩罗(validCards: CardInstance[], maxCount: number): string[] {
  // 效果价值评分表（基于妖怪名称）
  const effectValue: Record<string, number> = {
    // 伤害类（高价值）
    '心眼': 6,      // 伤害+3
    '针女': 5,      // 伤害+2
    '涅槃之火': 5,  // 伤害+2
    '天邪鬼赤': 4,  // 伤害+1 + 换牌
    '天邪鬼青': 3,  // 伤害+1 或 抓牌+1
    '唐纸伞妖': 3,  // 伤害+1 + 可超度
    '赤舌': 2,      // 伤害+1 + 妨害
    
    // 抓牌类（中价值）
    '树妖': 4,      // 抓牌+2 弃1
    '天邪鬼黄': 4,  // 抓牌+2 置顶1
    '蚌精': 4,      // 超度1 抓牌+2
    '灯笼鬼': 3,    // 抓牌+1
    '蝠翼': 3,      // 抓牌+1
    
    // 鬼火类（较低价值，因为回合结束归还无法获得声誉）
    '鸣屋': 2,      // 鬼火+1
    '兵主部': 2,    // 鬼火+1 + 条件伤害
    
    // 特殊效果（需考虑场景）
    '骰子鬼': 5,    // 超度+退治
    '轮入道': 4,    // 弃1使用2次效果
    '魅妖': 3,      // 看对手牌
    '天邪鬼绿': 3,  // 退治HP≤4妖怪
    
    // 默认
    'default': 1
  };
  
  // 按价值排序
  const sorted = [...validCards].sort((a, b) => {
    const valueA = effectValue[a.name] ?? effectValue['default'];
    const valueB = effectValue[b.name] ?? effectValue['default'];
    return valueB - valueA;
  });
  
  // 选择前 maxCount 张
  return sorted.slice(0, maxCount).map(c => c.instanceId);
}

// ============================================
// 生命8 妖怪效果
// ============================================

// 青女房 - 抓牌+2，鬼火+1
registerEffect('青女房', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 2);
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  return { success: true, message: '青女房：抓牌+2，鬼火+1', draw: 2, ghostFire: 1 };
});

// 三味 - 本回合每使用1张鬼火牌或阴阳术伤害+2
registerEffect('三味', async (ctx) => {
  const { player } = ctx;
  
  // 1. 统计本回合已使用的「鬼火」牌和阴阳术数量
  const played = (player as any).played as CardInstance[] | undefined;
  let ghostFireCount = 0;
  
  if (played) {
    for (const card of played) {
      // 阴阳术 (spell)
      if (card.cardType === 'spell') {
        ghostFireCount++;
      }
      // 「鬼火」牌 (subtype包含"鬼火"的御魂)
      else if (card.cardType === 'yokai') {
        const tags = card.tags || [];
        const subtype = (card as any).subtype || '';
        if (tags.includes('鬼火') || subtype.includes('鬼火')) {
          ghostFireCount++;
        }
      }
    }
  }
  
  // 2. 即时伤害加成（仅打出时按已打出区统计一次，无后续 SPELL_DAMAGE_BONUS）
  const immediateDamage = ghostFireCount * 2;
  player.damage += immediateDamage;

  const msg =
    ghostFireCount > 0
      ? `三味：已用${ghostFireCount}张御魂(鬼火)/阴阳术，伤害+${immediateDamage}`
      : '三味：本回合尚无符合条件的已打出牌，伤害+0';
  
  return { success: true, message: msg, damage: immediateDamage };
});

// ============================================
// 触发效果辅助函数
// ============================================

/**
 * 统一处理【触】弃置效果
 * 当卡牌被主动弃置时（非回合结束清理），触发其【触】效果
 * @param player 弃置卡牌的玩家
 * @param card 被弃置的卡牌
 * @returns 是否触发了任何效果
 */
export function triggerOnDiscard(player: PlayerState, card: CardInstance): boolean {
  switch (card.name) {
    case '树妖':
      drawCards(player, 2);
      return true;
    case '三味':
      drawCards(player, 3);
      return true;
    // 未来可扩展其他【触】弃置效果
    default:
      return false;
  }
}

// 树妖：被弃置时抓牌+2（兼容旧接口）
export function onTreeDemonDiscard(player: PlayerState, card: CardInstance): void {
  if (card.name === '树妖') {
    drawCards(player, 2);
  }
}

// 三味：被弃置时抓牌+3（兼容旧接口）
export function onSanmiDiscard(player: PlayerState, card: CardInstance): void {
  if (card.name === '三味') {
    drawCards(player, 3);
  }
}

// 铮：受到妨害时可弃置此牌抓牌+2并免疫
export function canZhengCounter(player: PlayerState): CardInstance | null {
  return player.hand.find(c => c.name === '铮') || null;
}

export function useZhengCounter(player: PlayerState): boolean {
  const idx = player.hand.findIndex(c => c.name === '铮');
  if (idx !== -1) {
    player.discard.push(player.hand.splice(idx, 1)[0]!);
    drawCards(player, 2);
    return true;
  }
  return false;
}

// 青女房：展示可免疫妨害和鬼王来袭
export function canQingnvfangImmune(player: PlayerState): boolean {
  return player.hand.some(c => c.name === '青女房');
}

export { drawCards, registerEffect, effectHandlers };

// ============================================
// 兼容层：为测试提供 YOKAI_EFFECT_DEFS 格式
// ============================================

/** 妖怪效果定义（兼容测试用） */
export interface YokaiEffectDef {
  cardId: string;
  cardName: string;
  effects: any[];
}

/** 从已注册的处理器生成效果定义列表 */
/** 与 cards.json 中的 yokai 数组顺序对齐（2026-03 修复映射偏移问题） */
export const YOKAI_EFFECT_DEFS: YokaiEffectDef[] = [
  { cardId: 'yokai_001', cardName: '赤舌', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_002', cardName: '唐纸伞妖', effects: [{ type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_003', cardName: '天邪鬼绿', effects: [{ type: 'KILL_YOKAI', maxHp: 4 }] },
  { cardId: 'yokai_004', cardName: '天邪鬼青', effects: [{ type: 'CHOICE', options: [{ label: '抓牌+1', effects: [{ type: 'DRAW', count: 1 }] }, { label: '伤害+1', effects: [{ type: 'DAMAGE', value: 1 }] }] }] },
  { cardId: 'yokai_005', cardName: '天邪鬼赤', effects: [{ type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_006', cardName: '天邪鬼黄', effects: [{ type: 'DRAW', count: 2 }, { type: 'PUT_TOP', count: 1 }] },
  { cardId: 'yokai_007', cardName: '魅妖', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_008', cardName: '灯笼鬼', effects: [{ type: 'GHOST_FIRE', value: 1 }, { type: 'DRAW', count: 1 }] },
  { cardId: 'yokai_009', cardName: '树妖', effects: [{ type: 'DRAW', count: 2 }] },
  { cardId: 'yokai_010', cardName: '日女巳时', effects: [{ type: 'CHOICE', options: [{ label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] }, { label: '抓牌+2', effects: [{ type: 'DRAW', count: 2 }] }, { label: '伤害+2', effects: [{ type: 'DAMAGE', value: 2 }] }] }] },
  { cardId: 'yokai_011', cardName: '蚌精', effects: [{ type: 'EXILE_HAND', count: 1 }, { type: 'DRAW', count: 2 }] },
  { cardId: 'yokai_012', cardName: '鸣屋', effects: [{ type: 'CONDITIONAL', condition: { key: 'DISCARD_EMPTY', op: '=', value: 1 }, thenEffects: [{ type: 'DAMAGE', value: 4 }], elseEffects: [{ type: 'DAMAGE', value: 2 }] }] },
  { cardId: 'yokai_013', cardName: '蝠翼', effects: [{ type: 'DRAW', count: 2 }] },
  // 以下 yokai_014-038 与 cards.json 保持一致（2026-03 修复映射偏移问题）
  { cardId: 'yokai_014', cardName: '兵主部', effects: [{ type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_015', cardName: '魍魉之匣', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_016', cardName: '骰子鬼', effects: [{ type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_017', cardName: '涅槃之火', effects: [{ type: 'TEMP_BUFF', buffType: 'SKILL_COST_REDUCE', value: 1 }] },
  { cardId: 'yokai_018', cardName: '雪幽魂', effects: [{ type: 'DRAW', count: 1 }, { type: 'INTERFERE' }] },
  { cardId: 'yokai_019', cardName: '轮入道', effects: [] },  // 特殊：执行两次御魂
  { cardId: 'yokai_020', cardName: '网切', effects: [{ type: 'REDUCE_HP', yokai: 1, boss: 2 }] },
  { cardId: 'yokai_021', cardName: '铮', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_022', cardName: '薙魂', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_023', cardName: '狂骨', effects: [{ type: 'DRAW', count: 1 }] },  // 伤害=鬼火数
  { cardId: 'yokai_024', cardName: '返魂香', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_025', cardName: '镇墓兽', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 2 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_026', cardName: '针女', effects: [{ type: 'DAMAGE', value: 1 }, { type: 'TEMP_BUFF', buffType: 'SKILL_DAMAGE_BONUS', value: 1 }] },
  { cardId: 'yokai_027', cardName: '心眼', effects: [{ type: 'DAMAGE', value: 3 }] },
  { cardId: 'yokai_028', cardName: '涂佛', effects: [{ type: 'RECOVER_FROM_DISCARD' }] },
  { cardId: 'yokai_029', cardName: '地藏像', effects: [{ type: 'DRAW', count: 3 }] },
  { cardId: 'yokai_030', cardName: '飞缘魔', effects: [{ type: 'DAMAGE', value: 2 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_031', cardName: '破势', effects: [{ type: 'CONDITIONAL', condition: { type: 'FIRST_CARD' }, thenEffects: [{ type: 'DAMAGE', value: 5 }], elseEffects: [{ type: 'DAMAGE', value: 3 }] }] },
  { cardId: 'yokai_032', cardName: '镜姬', effects: [{ type: 'DRAW', count: 2 }, { type: 'DAMAGE', value: 1 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_033', cardName: '木魅', effects: [{ type: 'DRAW', count: 3 }] },
  { cardId: 'yokai_034', cardName: '幽谷响', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_035', cardName: '伤魂鸟', effects: [] },  // 特殊：超度X张伤害+2X
  { cardId: 'yokai_036', cardName: '阴摩罗', effects: [{ type: 'RECOVER_FROM_DISCARD' }] },
  { cardId: 'yokai_037', cardName: '青女房', effects: [{ type: 'DRAW', count: 2 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_038', cardName: '三味', effects: [] }, // 实时统计 played，无 TEMP_BUFF
];

/** 根据卡牌ID获取效果定义 */
export function getYokaiEffectDef(cardId: string): YokaiEffectDef | undefined {
  return YOKAI_EFFECT_DEFS.find(d => d.cardId === cardId);
}

/** 根据名称获取效果定义 */
export function getYokaiEffectDefByName(name: string): YokaiEffectDef | undefined {
  return YOKAI_EFFECT_DEFS.find(d => d.cardName === name);
}
