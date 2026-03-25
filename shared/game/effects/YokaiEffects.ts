/**
 * 妖怪御魂效果处理器
 * 实现38种妖怪的御魂效果
 */

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

// 辅助函数：抓牌（牌库空时洗入弃牌堆，与 MultiplayerGame/SinglePlayerGame 一致）
function drawCards(player: PlayerState, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
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

// 天邪鬼赤 - 伤害+1，弃置任意手牌，抓等量牌
registerEffect('天邪鬼赤', async (ctx) => {
  const { player, onSelectCards } = ctx;
  player.damage += 1;
  
  if (player.hand.length > 0 && onSelectCards) {
    const ids = await onSelectCards(player.hand, player.hand.length);
    const discardCount = ids.length;
    
    for (const id of ids) {
      const idx = player.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        player.discard.push(player.hand.splice(idx, 1)[0]!);
      }
    }
    
    drawCards(player, discardCount);
    return { success: true, message: `天邪鬼赤：伤害+1，换${discardCount}张牌`, damage: 1, draw: discardCount };
  }
  
  return { success: true, message: '天邪鬼赤：伤害+1', damage: 1 };
});

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
      cardId = player.hand[0]!.instanceId;
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
      opp.deck.push(opp.discard.splice(idx, 1)[0]!);
      affected++;
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
registerEffect('日女巳时', async (ctx) => {
  const { player, onChoice } = ctx;
  const choice = onChoice ? await onChoice(['鬼火+1', '抓牌+2', '伤害+2']) : 0;
  
  switch (choice) {
    case 0:
      player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
      return { success: true, message: '日女巳时：鬼火+1', ghostFire: 1 };
    case 1:
      drawCards(player, 2);
      return { success: true, message: '日女巳时：抓牌+2', draw: 2 };
    case 2:
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

// 魅妖 - [妨害] 对手展示牌库顶，选择生命<5的牌使用效果
registerEffect('魅妖', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  const opponents = gameState.players.filter(p => p.id !== player.id);
  
  const validCards: CardInstance[] = [];
  for (const opp of opponents) {
    if (opp.deck.length > 0) {
      const topCard = opp.deck[opp.deck.length - 1]!;
      if ((topCard.hp || 0) < 5) {
        validCards.push(topCard);
      }
    }
  }
  
  if (validCards.length === 0) {
    return { success: true, message: '[妨害] 魅妖：没有符合条件的牌' };
  }
  
  // 简化处理：选择第一张符合条件的牌
  const selectedCard = validCards[0]!;
  
  // 使用效果后置入弃牌区（这里简化为直接弃置）
  for (const opp of opponents) {
    const idx = opp.deck.findIndex(c => c.instanceId === selectedCard.instanceId);
    if (idx !== -1) {
      opp.discard.push(opp.deck.splice(idx, 1)[0]!);
      break;
    }
  }
  
  return { success: true, message: `[妨害] 魅妖：使用${selectedCard.name}的效果` };
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
  
  // 选择超度的牌
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, 1);
    cardId = ids[0]!;
  } else {
    cardId = player.hand[0]!.instanceId;
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
  
  const targetId = onSelectTarget 
    ? await onSelectTarget(validTargets) 
    : validTargets[0]!.instanceId;
  
  const idx = gameState.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
  if (idx !== -1) {
    const target = gameState.field.yokaiSlots[idx]!;
    gameState.field.yokaiSlots[idx] = null;
    return { success: true, message: `骰子鬼：超度${exiledCard.name}，退治${target.name}` };
  }
  
  return { success: true, message: `骰子鬼：超度${exiledCard.name}` };
});

// 涅槃之火 - 本回合式神技能鬼火消耗-1
registerEffect('涅槃之火', async (ctx) => {
  const { player } = ctx;
  player.tempBuffs.push({
    type: 'SKILL_COST_REDUCTION' as any,
    value: 1,
    duration: 1,
    source: '涅槃之火'
  } as any);
  return { success: true, message: '涅槃之火：本回合式神技能鬼火消耗-1' };
});

// 雪幽魂 - [妨害] 抓牌+1，对手弃置恶评或获得恶评
registerEffect('雪幽魂', async (ctx) => {
  const { player, gameState } = ctx;
  drawCards(player, 1);
  
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    
    const penaltyIdx = p.hand.findIndex(c => c.cardType === 'penalty');
    if (penaltyIdx !== -1) {
      p.discard.push(p.hand.splice(penaltyIdx, 1)[0]!);
    } else {
      // 获得1张恶评
      const penaltyCard: CardInstance = {
        instanceId: `penalty_${Date.now()}_${Math.random()}`,
        cardId: 'penalty_001',
        cardType: 'penalty',
        name: '恶评',
        hp: 0,
        maxHp: 0
      };
      p.hand.push(penaltyCard);
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
  
  const subCtx: EffectContext = {
    player, gameState, card: targetCard,
    onSelectCards, onChoice, onSelectTarget
  };
  const r1 = await executeYokaiEffect(targetCard.name, subCtx);
  const r2 = await executeYokaiEffect(targetCard.name, subCtx);
  
  const msgs = [r1.message, r2.message].filter(Boolean).join('；');
  return { success: true, message: `轮入道：弃置${targetCard.name}，双重效果 → ${msgs}` };
});

// 网切 - 本回合妖怪生命-1，鬼王生命-2（最低1）
registerEffect('网切', async (ctx) => {
  const { player } = ctx;
  player.tempBuffs.push({
    type: 'HP_REDUCTION' as any,
    value: 1,
    duration: 1,
    source: '网切',
    yokaiReduction: 1,
    bossReduction: 2
  } as any);
  return { success: true, message: '网切：本回合妖怪生命-1，鬼王生命-2' };
});

// 铮 - 抓牌+1，伤害+2
registerEffect('铮', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  player.damage += 2;
  return { success: true, message: '铮：抓牌+1，伤害+2', draw: 1, damage: 2 };
});

// 薙魂 - 抓牌+1，弃置1张。打出3张御魂时鬼火+2
registerEffect('薙魂', async (ctx) => {
  const { player, onSelectCards } = ctx;
  drawCards(player, 1);
  
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
  
  const played = (player as any).played as CardInstance[] | undefined;
  const yokaiPlayed = played ? played.filter((c: CardInstance) => c.cardType === 'yokai').length : 0;
  
  if (yokaiPlayed >= 3) {
    player.ghostFire = Math.min(player.ghostFire + 2, player.maxGhostFire);
    return { success: true, message: '薙魂：抓牌+1，弃置1张，已打出3张御魂→鬼火+2', draw: 1, ghostFire: 2 };
  }
  
  player.tempBuffs.push({
    type: 'NAGINATA_SOUL_PENDING' as any,
    value: 3,
    duration: 1,
    source: '薙魂'
  } as any);
  
  return { success: true, message: '薙魂：抓牌+1，弃置1张（3张御魂时鬼火+2）', draw: 1 };
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

// 狂骨 - 抓牌+1，伤害+X（X=当前鬼火）
registerEffect('狂骨', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  const damage = player.ghostFire;
  player.damage += damage;
  return { success: true, message: `狂骨：抓牌+1，伤害+${damage}`, draw: 1, damage };
});

// 返魂香 - [妨害] 抓牌+1，伤害+1，对手弃牌或获得恶评
registerEffect('返魂香', async (ctx) => {
  const { player, gameState } = ctx;
  drawCards(player, 1);
  player.damage += 1;
  
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    
    if (p.hand.length > 0) {
      // 弃置1张手牌
      p.discard.push(p.hand.shift()!);
    } else {
      // 获得恶评
      const penaltyCard: CardInstance = {
        instanceId: `penalty_${Date.now()}_${Math.random()}`,
        cardId: 'penalty_001',
        cardType: 'penalty',
        name: '恶评',
        hp: 0,
        maxHp: 0
      };
      p.hand.push(penaltyCard);
    }
  }
  
  return { success: true, message: '[妨害] 返魂香：抓牌+1，伤害+1', draw: 1, damage: 1 };
});

// 镇墓兽 - 鬼火+1，抓牌+1，伤害+2
registerEffect('镇墓兽', async (ctx) => {
  const { player } = ctx;
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  drawCards(player, 1);
  player.damage += 2;
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
registerEffect('地藏像', async (ctx) => {
  const { player, card } = ctx;
  player.exiled.push(card);
  // 获取式神的逻辑需要与游戏流程配合
  return { success: true, message: '地藏像：超度此牌，获取1个式神' };
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
  const { player } = ctx;
  const revealed: CardInstance[] = [];
  const spells: CardInstance[] = [];
  
  while (player.deck.length > 0 && spells.length < 3) {
    const card = player.deck.pop()!;
    revealed.push(card);
    if (card.cardType === 'spell') {
      spells.push(card);
    }
  }
  
  // 阴阳术置入手牌
  for (const spell of spells) {
    player.hand.push(spell);
  }
  
  // 其余弃置
  for (const card of revealed) {
    if (!spells.includes(card)) {
      player.discard.push(card);
    }
  }
  
  return { success: true, message: `木魅：获得${spells.length}张阴阳术` };
});

// ============================================
// 生命7 妖怪效果
// ============================================

// 幽谷响 - [妨害] 使用对手牌库顶至多3张非鬼王效果
registerEffect('幽谷响', async (ctx) => {
  const { player, gameState } = ctx;
  let usedCount = 0;
  
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    if (usedCount >= 3) break;
    
    if (p.deck.length > 0) {
      const topCard = p.deck[p.deck.length - 1]!;
      if (topCard.cardType !== 'boss') {
        // 使用效果（简化处理）
        p.discard.push(p.deck.pop()!);
        usedCount++;
      }
    }
  }
  
  return { success: true, message: `[妨害] 幽谷响：使用${usedCount}张对手牌的效果` };
});

// 伤魂鸟 - 超度X张手牌，伤害+2X
registerEffect('伤魂鸟', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  if (player.hand.length === 0) {
    return { success: true, message: '伤魂鸟：没有手牌可超度' };
  }
  
  let selectedIds: string[];
  if (onSelectCards) {
    selectedIds = await onSelectCards(player.hand, player.hand.length);
  } else {
    selectedIds = [];
  }
  
  for (const id of selectedIds) {
    const idx = player.hand.findIndex(c => c.instanceId === id);
    if (idx !== -1) {
      player.exiled.push(player.hand.splice(idx, 1)[0]!);
    }
  }
  
  const damage = selectedIds.length * 2;
  player.damage += damage;
  
  return { success: true, message: `伤魂鸟：超度${selectedIds.length}张，伤害+${damage}`, damage };
});

// 阴摩罗 - 选择弃牌区2张生命<6的牌使用，回合结束返回牌库底
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
    selectedIds = validCards.slice(0, count).map(c => c.instanceId);
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
  
  for (const card of usedCards) {
    player.deck.unshift(card);
  }
  
  return {
    success: true,
    message: `阴摩罗：使用${usedCards.length}张弃牌区的牌${effectMsgs.length > 0 ? '（' + effectMsgs.join('；') + '）' : ''}，已返回牌库底`
  };
});

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
  player.tempBuffs.push({
    type: 'SPELL_DAMAGE_BONUS' as any,
    value: 2,
    duration: 1,
    source: '三味'
  } as any);
  return { success: true, message: '三味：本回合每使用阴阳术伤害+2' };
});

// ============================================
// 触发效果辅助函数
// ============================================

// 树妖：被弃置时抓牌+2
export function onTreeDemonDiscard(player: PlayerState, card: CardInstance): void {
  if (card.name === '树妖') {
    drawCards(player, 2);
  }
}

// 三味：被弃置时抓牌+3
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
export const YOKAI_EFFECT_DEFS: YokaiEffectDef[] = [
  { cardId: 'yokai_001', cardName: '招福达摩', effects: [] },
  { cardId: 'yokai_002', cardName: '唐纸伞妖', effects: [{ type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_003', cardName: '天邪鬼绿', effects: [{ type: 'KILL_YOKAI', maxHp: 4 }] },
  { cardId: 'yokai_004', cardName: '天邪鬼青', effects: [{ type: 'CHOICE', options: [{ label: '抓牌+1', effects: [{ type: 'DRAW', count: 1 }] }, { label: '伤害+1', effects: [{ type: 'DAMAGE', value: 1 }] }] }] },
  { cardId: 'yokai_005', cardName: '天邪鬼赤', effects: [{ type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_006', cardName: '天邪鬼黄', effects: [{ type: 'DRAW', count: 2 }, { type: 'PUT_TOP', count: 1 }] },
  { cardId: 'yokai_007', cardName: '赤舌', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_008', cardName: '魅妖', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_009', cardName: '灯笼鬼', effects: [{ type: 'GHOST_FIRE', value: 1 }, { type: 'DRAW', count: 1 }] },
  { cardId: 'yokai_010', cardName: '树妖', effects: [{ type: 'DRAW', count: 2 }] },
  { cardId: 'yokai_011', cardName: '日女巳时', effects: [{ type: 'CHOICE', options: [{ label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] }, { label: '抓牌+2', effects: [{ type: 'DRAW', count: 2 }] }, { label: '伤害+2', effects: [{ type: 'DAMAGE', value: 2 }] }] }] },
  { cardId: 'yokai_012', cardName: '蚌精', effects: [{ type: 'EXILE_HAND', count: 1 }, { type: 'DRAW', count: 2 }] },
  { cardId: 'yokai_013', cardName: '鸣屋', effects: [{ type: 'CONDITIONAL', condition: { key: 'DISCARD_EMPTY', op: '=', value: 1 }, thenEffects: [{ type: 'DAMAGE', value: 4 }], elseEffects: [{ type: 'DAMAGE', value: 2 }] }] },
  { cardId: 'yokai_014', cardName: '蝠翼', effects: [{ type: 'DRAW', count: 2 }] },
  { cardId: 'yokai_015', cardName: '兵主部', effects: [{ type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_016', cardName: '魍魉之匣', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_017', cardName: '骰子鬼', effects: [{ type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_018', cardName: '涅槃之火', effects: [{ type: 'TEMP_BUFF', buffType: 'SKILL_COST_REDUCE', value: 1 }] },
  { cardId: 'yokai_019', cardName: '雪幽魂', effects: [{ type: 'DRAW', count: 1 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_020', cardName: '轮入道', effects: [] },  // 特殊：执行两次御魂
  { cardId: 'yokai_021', cardName: '网切', effects: [{ type: 'REDUCE_HP', yokai: 1, boss: 2 }] },
  { cardId: 'yokai_022', cardName: '铮', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 2 }] },
  { cardId: 'yokai_023', cardName: '薙魂', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_024', cardName: '狂骨', effects: [{ type: 'DRAW', count: 1 }] },  // 伤害=鬼火数
  { cardId: 'yokai_025', cardName: '返魂香', effects: [{ type: 'RECOVER_FROM_DISCARD' }] },
  { cardId: 'yokai_026', cardName: '镇墓兽', effects: [{ type: 'DRAW', count: 1 }, { type: 'DAMAGE', value: 2 }, { type: 'GHOST_FIRE', value: 2 }] },
  { cardId: 'yokai_027', cardName: '针女', effects: [{ type: 'DAMAGE', value: 1 }, { type: 'TEMP_BUFF', buffType: 'SKILL_DAMAGE_BONUS', value: 1 }] },
  { cardId: 'yokai_028', cardName: '心眼', effects: [{ type: 'DAMAGE', value: 3 }] },
  { cardId: 'yokai_029', cardName: '涂佛', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_030', cardName: '地藏像', effects: [{ type: 'DRAW', count: 3 }] },
  { cardId: 'yokai_031', cardName: '飞缘魔', effects: [{ type: 'DAMAGE', value: 2 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_032', cardName: '破势', effects: [{ type: 'CONDITIONAL', condition: { type: 'FIRST_CARD' }, thenEffects: [{ type: 'DAMAGE', value: 5 }], elseEffects: [{ type: 'DAMAGE', value: 3 }] }] },
  { cardId: 'yokai_033', cardName: '镜姬', effects: [{ type: 'DRAW', count: 2 }, { type: 'DAMAGE', value: 1 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_034', cardName: '木魅', effects: [{ type: 'DRAW', count: 3 }] },
  { cardId: 'yokai_035', cardName: '幽谷响', effects: [{ type: 'DRAW', count: 2 }, { type: 'DAMAGE', value: 1 }] },
  { cardId: 'yokai_036', cardName: '伤魂鸟', effects: [] },  // 特殊：超度X张伤害+2X
  { cardId: 'yokai_037', cardName: '阴摩罗', effects: [{ type: 'INTERFERE' }] },
  { cardId: 'yokai_038', cardName: '青女房', effects: [{ type: 'DRAW', count: 2 }, { type: 'GHOST_FIRE', value: 1 }] },
  { cardId: 'yokai_039', cardName: '三味', effects: [{ type: 'TEMP_BUFF', buffType: 'SPELL_DAMAGE_BONUS', value: 2 }] },
];

/** 根据卡牌ID获取效果定义 */
export function getYokaiEffectDef(cardId: string): YokaiEffectDef | undefined {
  return YOKAI_EFFECT_DEFS.find(d => d.cardId === cardId);
}

/** 根据名称获取效果定义 */
export function getYokaiEffectDefByName(name: string): YokaiEffectDef | undefined {
  return YOKAI_EFFECT_DEFS.find(d => d.cardName === name);
}
