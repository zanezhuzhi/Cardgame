/**
 * 式神技能处理器
 * @file shared/game/effects/ShikigamiSkills.ts
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
  boss: CardInstance | null;
  bossMaxHp: number;
  bossCurrentHp: number;
}

interface GameState {
  players: PlayerState[];
  field: FieldState;
  [key: string]: any;
}

export interface SkillContext {
  player: PlayerState;
  gameState: GameState;
  shikigamiIndex: number;
  onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
  onChoice?: (options: string[]) => Promise<number>;
  onSelectTarget?: (targets: CardInstance[]) => Promise<string>;
}

export interface SkillResult {
  success: boolean;
  message: string;
  costPaid?: number;
}

// 技能处理函数类型
type SkillHandler = (ctx: SkillContext, extraCost?: number) => Promise<SkillResult>;

// 技能注册表
const skillHandlers: Record<string, SkillHandler> = {};

// 注册技能
export function registerSkill(name: string, handler: SkillHandler) {
  skillHandlers[name] = handler;
}

// 执行技能
export async function executeSkill(
  skillName: string,
  ctx: SkillContext,
  extraCost?: number
): Promise<SkillResult> {
  const handler = skillHandlers[skillName];
  if (!handler) {
    return { success: false, message: `未实现的技能: ${skillName}` };
  }
  return handler(ctx, extraCost);
}

// 工具函数：抓牌
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

// 工具函数：消耗鬼火
function payGhostFire(player: PlayerState, cost: number): boolean {
  if (player.ghostFire < cost) return false;
  player.ghostFire -= cost;
  return true;
}

// ============ R级式神技能 ============

// #23 座敷童子「魂之火」
// 【启】弃置1张妖怪牌：鬼火+1
registerSkill('魂之火', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  // 检查手牌中是否有妖怪牌
  const yokaiCards = player.hand.filter(c => c.cardType === 'yokai');
  if (yokaiCards.length === 0) {
    return { success: false, message: '手牌中没有妖怪牌' };
  }
  
  // 选择弃置的妖怪牌
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(yokaiCards, 1);
    cardId = ids[0]!;
  } else {
    cardId = yokaiCards[0]!.instanceId;
  }
  
  // 弃置妖怪牌
  const idx = player.hand.findIndex(c => c.instanceId === cardId);
  if (idx !== -1) {
    const card = player.hand.splice(idx, 1)[0]!;
    player.discard.push(card);
  }
  
  // 鬼火+1
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  
  return { success: true, message: '弃置妖怪牌，鬼火+1' };
});

// #24 山兔「兔子舞」
// 【启】鬼火-1：抓牌+1，然后弃置1张牌。若弃置了妖怪牌，则伤害+1
registerSkill('兔子舞', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 抓牌+1
  drawCards(player, 1);
  
  // 弃置1张牌
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
      const card = player.hand.splice(idx, 1)[0]!;
      player.discard.push(card);
      
      // 若弃置妖怪牌，伤害+1
      if (card.cardType === 'yokai') {
        player.damage += 1;
        return { success: true, message: '抓牌+1，弃置妖怪牌，伤害+1', costPaid: 1 };
      }
    }
  }
  
  return { success: true, message: '抓牌+1，弃置1张牌', costPaid: 1 };
});

// #6 书翁「万象之书」
// 【启】鬼火-N：伤害+N+1（N不能为0）
registerSkill('万象之书', async (ctx, extraCost) => {
  const { player } = ctx;
  const n = extraCost ?? 1;
  
  if (n <= 0) {
    return { success: false, message: 'N不能为0' };
  }
  
  if (!payGhostFire(player, n)) {
    return { success: false, message: `鬼火不足（需要${n}点）` };
  }
  
  player.damage += n + 1;
  
  return { success: true, message: `鬼火-${n}，伤害+${n + 1}`, costPaid: n };
});

// #11 白狼「冥想」
// 【启】鬼火-1，弃置N张手牌：伤害+N
registerSkill('冥想', async (ctx, discardCount) => {
  const { player, onSelectCards } = ctx;
  const n = discardCount ?? 1;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  if (player.hand.length < n) {
    player.ghostFire += 1; // 退还
    return { success: false, message: `手牌不足（需要${n}张）` };
  }
  
  // 弃置N张牌
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, n);
    for (const id of ids) {
      const idx = player.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        player.discard.push(player.hand.splice(idx, 1)[0]!);
      }
    }
  } else {
    for (let i = 0; i < n && player.hand.length > 0; i++) {
      player.discard.push(player.hand.shift()!);
    }
  }
  
  player.damage += n;
  
  return { success: true, message: `弃置${n}张牌，伤害+${n}`, costPaid: 1 };
});

// ============ SSR级式神技能 ============

// #2 大天狗「羽刃暴风」
// 【启】鬼火-2：回合中你可以选择1个目标。当你对其他目标造成N点伤害时，对其造成N-2点伤害
registerSkill('羽刃暴风', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  
  if (!payGhostFire(player, 2)) {
    return { success: false, message: '鬼火不足（需要2点）' };
  }
  
  // 选择一个目标（需要UI交互）
  const yokaiOnField = gameState.field.yokaiSlots.filter((y): y is CardInstance => y !== null);
  
  if (yokaiOnField.length === 0) {
    player.ghostFire += 2; // 退还
    return { success: false, message: '场上没有可选择的目标' };
  }
  
  let targetId: string;
  if (onSelectTarget) {
    targetId = await onSelectTarget(yokaiOnField);
  } else {
    targetId = yokaiOnField[0]!.instanceId;
  }
  
  // 添加临时增益：对其他目标造成伤害时，主目标也受到 N-2 点伤害
  player.tempBuffs.push({
    type: 'STORM_BLADE' as any,
    value: 2, // 减免值
    duration: 1,
    target: targetId, // 主目标
    source: '羽刃暴风'
  } as any);
  
  return { 
    success: true, 
    message: '选择目标，对其他目标造成伤害时，主目标也受到N-2点伤害', 
    costPaid: 2 
  };
});

// #1 妖刀姬「杀戮」
// 【启】鬼火-2：抓牌+1，伤害+1。可额外鬼火-1，重复一次效果
registerSkill('杀戮', async (ctx, repeat) => {
  const { player } = ctx;
  const doRepeat = repeat === 1;
  const totalCost = doRepeat ? 3 : 2;
  
  if (!payGhostFire(player, totalCost)) {
    return { success: false, message: `鬼火不足（需要${totalCost}点）` };
  }
  
  // 基础效果：抓牌+1，伤害+1
  drawCards(player, 1);
  player.damage += 1;
  
  // 重复效果
  if (doRepeat) {
    drawCards(player, 1);
    player.damage += 1;
    return { success: true, message: '抓牌+2，伤害+2', costPaid: 3 };
  }
  
  return { success: true, message: '抓牌+1，伤害+1', costPaid: 2 };
});

// #3 酒吞童子「酒葫芦」
// 【启】鬼火-2：超度1张手牌并放置1枚「酒气」指示物（上限为3）
// 【启】移除N枚「酒气」指示物：伤害+N
registerSkill('酒葫芦', async (ctx, mode) => {
  const { player, shikigamiIndex, onSelectCards } = ctx;
  const state = player.shikigamiState[shikigamiIndex];
  
  if (!state) {
    return { success: false, message: '式神状态异常' };
  }
  
  // mode = 0: 放置酒气, mode > 0: 移除N枚酒气
  if (mode === undefined || mode === 0) {
    // 放置酒气
    if (!payGhostFire(player, 2)) {
      return { success: false, message: '鬼火不足（需要2点）' };
    }
    
    if (player.hand.length === 0) {
      player.ghostFire += 2; // 退还
      return { success: false, message: '没有手牌可超度' };
    }
    
    // 超度1张手牌
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
    
    // 放置酒气（上限3）
    const current = (state.markers['酒气'] as number) || 0;
    if (current >= 3) {
      return { success: true, message: '超度手牌，酒气已达上限(3)', costPaid: 2 };
    }
    state.markers['酒气'] = current + 1;
    
    return { success: true, message: `超度手牌，酒气+1（当前${current + 1}/3）`, costPaid: 2 };
  } else {
    // 移除N枚酒气获得伤害
    const n = mode;
    const current = (state.markers['酒气'] as number) || 0;
    
    if (current < n) {
      return { success: false, message: `酒气不足（当前${current}，需要${n}）` };
    }
    
    state.markers['酒气'] = current - n;
    if (state.markers['酒气'] === 0) {
      delete state.markers['酒气'];
    }
    
    player.damage += n;
    
    return { success: true, message: `移除${n}枚酒气，伤害+${n}` };
  }
});

// #4 茨木童子「迁怒」
// 【启】鬼火-2：本回合中，你每超度或退治1个妖怪，获得伤害+2
registerSkill('迁怒', async (ctx) => {
  const { player } = ctx;
  
  if (!payGhostFire(player, 2)) {
    return { success: false, message: '鬼火不足（需要2点）' };
  }
  
  // 添加临时增益
  player.tempBuffs.push({
    type: 'DAMAGE_PER_YOKAI_KILL' as any,
    value: 2,
    duration: 1,
    condition: { event: 'ON_YOKAI_KILLED' }
  });
  
  return { success: true, message: '本回合中，每超度或退治1个妖怪，伤害+2', costPaid: 2 };
});

// #5 花鸟卷「画境」（主动技能部分）
// 【启】鬼火-2：抓牌+3，然后，将1张手牌置于牌库底
registerSkill('画境', async (ctx) => {
  const { player, onSelectCards } = ctx;
  
  if (!payGhostFire(player, 2)) {
    return { success: false, message: '鬼火不足（需要2点）' };
  }
  
  // 抓牌+3
  drawCards(player, 3);
  
  // 将1张手牌置于牌库底
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
      const card = player.hand.splice(idx, 1)[0]!;
      player.deck.unshift(card); // 放到牌库底
    }
  }
  
  return { success: true, message: '抓牌+3，将1张手牌置于牌库底', costPaid: 2 };
});

// ============ SR级式神技能（补充） ============

// #7 百目鬼「诅咒之眼」🔷
// 【启】[妨害] 鬼火-1：所有玩家弃置1张手牌，然后你抓牌+1
registerSkill('诅咒之眼', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 所有玩家弃置1张手牌（包括自己）
  for (const p of gameState.players) {
    if (p.hand.length > 0) {
      // 如果是当前玩家，让其选择弃牌
      if (p.id === player.id && onSelectCards) {
        const ids = await onSelectCards(p.hand, 1);
        const idx = p.hand.findIndex(c => c.instanceId === ids[0]);
        if (idx !== -1) {
          p.discard.push(p.hand.splice(idx, 1)[0]!);
        }
      } else {
        // 其他玩家自动弃置第一张（实际游戏中应该让对手选择）
        p.discard.push(p.hand.shift()!);
      }
    }
  }
  
  // 你抓牌+1
  drawCards(player, 1);
  
  return { success: true, message: '[妨害] 所有玩家弃置1张手牌，你抓牌+1', costPaid: 1 };
});

// #9 般若「嫉恨之心」
// 【启】[妨害] 鬼火-1：所有玩家弃置牌库顶牌，你可以将你弃置的牌置入手牌，或将其超度
registerSkill('嫉恨之心', async (ctx) => {
  const { player, gameState, onChoice } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  let myDiscardedCard: CardInstance | null = null;
  
  // 所有玩家弃置牌库顶牌
  for (const p of gameState.players) {
    if (p.deck.length > 0) {
      const card = p.deck.pop()!;
      p.discard.push(card);
      
      // 记录自己弃置的牌
      if (p.id === player.id) {
        myDiscardedCard = card;
      }
    }
  }
  
  // 处理自己弃置的牌
  if (myDiscardedCard) {
    // 从弃牌堆中取出
    const idx = player.discard.findIndex(c => c.instanceId === myDiscardedCard!.instanceId);
    if (idx !== -1) {
      player.discard.splice(idx, 1);
    }
    
    // 选择：置入手牌 或 超度
    const choice = onChoice ? await onChoice(['置入手牌', '超度']) : 0;
    
    if (choice === 0) {
      player.hand.push(myDiscardedCard);
      return { success: true, message: `[妨害] 弃置牌库顶，将${myDiscardedCard.name}置入手牌`, costPaid: 1 };
    } else {
      player.exiled.push(myDiscardedCard);
      return { success: true, message: `[妨害] 弃置牌库顶，超度${myDiscardedCard.name}`, costPaid: 1 };
    }
  }
  
  return { success: true, message: '[妨害] 所有玩家弃置牌库顶牌', costPaid: 1 };
});

// #8 鬼使白「魂狩」
// 【启】鬼火-1：本回合中，首次退治生命不高于6的妖怪时，你可以将其置入手牌
registerSkill('魂狩', async (ctx) => {
  const { player } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 添加临时增益：首次退治生命≤6的妖怪时，置入手牌
  player.tempBuffs.push({
    type: 'CAPTURE_YOKAI' as any,
    value: 6, // 生命上限
    duration: 1,
    remainingUses: 1 // 只能触发一次
  });
  
  return { success: true, message: '本回合首次退治生命≤6的妖怪时，可置入手牌', costPaid: 1 };
});

// #18 山童「怪力」
// 【启】鬼火-1：本回合中，你使用的前2张阴阳术额外伤害+1
registerSkill('怪力', async (ctx) => {
  const { player } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 添加临时增益
  player.tempBuffs.push({
    type: 'SPELL_DAMAGE_BOOST' as any,
    value: 1,
    duration: 1,
    remainingUses: 2 // 前2张阴阳术
  });
  
  return { success: true, message: '本回合中，前2张阴阳术额外伤害+1', costPaid: 1 };
});

// #21 青蛙瓷器「岭上开花」
// 【启】鬼火-1：投掷1颗鬼火骰，若结果为4-5或鬼面，则伤害+2
registerSkill('岭上开花', async (ctx) => {
  const { player } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 投掷骰子（1-6，6为鬼面）
  const roll = Math.floor(Math.random() * 6) + 1;
  const isSuccess = roll >= 4; // 4, 5, 6(鬼面)都成功
  
  if (isSuccess) {
    player.damage += 2;
    const faceText = roll === 6 ? '鬼面' : roll.toString();
    return { success: true, message: `骰子结果: ${faceText}，伤害+2！`, costPaid: 1 };
  } else {
    return { success: true, message: `骰子结果: ${roll}，未达成条件`, costPaid: 1 };
  }
});

// ============ 永久被动技能 ============

// 女性目标列表（用于三尾狐的诱惑技能）
// 这是一个娱乐向的设定，玩家可以自行讨论
const FEMALE_TARGETS = new Set([
  // 妖怪
  '雪女', '姑获鸟', '络新妇', '青女房', '狸猫', '座敷童子', 
  '日女巳时', '针女', '般若', '鲤鱼精', '萤草', '丑时之女',
  // 式神（虽然式神不是目标，但为完整性列出）
  '花鸟卷', '妖刀姬', '萤草', '般若', '三尾狐'
]);

/**
 * 检查目标是否为女性
 * @param targetName 目标名称
 */
export function isFemaleTarget(targetName: string): boolean {
  return FEMALE_TARGETS.has(targetName);
}

// #20 三尾狐「诱惑」
// 【永】回合内首次对非女性目标造成的伤害+1
// 这是一个被动技能，在伤害计算时调用
export function checkSeductionBonus(
  player: PlayerState,
  targetName: string,
  shikigamiName: string
): { bonus: number; triggered: boolean } {
  // 检查玩家是否拥有三尾狐
  if (shikigamiName !== '三尾狐') {
    return { bonus: 0, triggered: false };
  }
  
  // 检查是否已经在本回合触发过
  const hasTriggered = player.tempBuffs.some(
    b => (b as any).source === '诱惑' && (b as any).hasTriggered
  );
  
  if (hasTriggered) {
    return { bonus: 0, triggered: false };
  }
  
  // 检查目标是否为非女性
  if (isFemaleTarget(targetName)) {
    return { bonus: 0, triggered: false };
  }
  
  // 触发效果，标记已触发
  player.tempBuffs.push({
    type: 'SEDUCTION_TRIGGERED' as any,
    value: 1,
    duration: 1,
    source: '诱惑',
    hasTriggered: true
  } as any);
  
  return { bonus: 1, triggered: true };
}

// #13 鲤鱼精「泡泡之盾」
// 【自】回合内首次退治妖怪或鬼王时，你可以将其放置在你的牌库顶
// 这是一个被动技能，在退治时调用
export function checkBubbleShield(
  player: PlayerState,
  shikigamiName: string
): boolean {
  if (shikigamiName !== '鲤鱼精') {
    return false;
  }
  
  // 检查是否已经在本回合触发过
  const hasTriggered = player.tempBuffs.some(
    b => (b as any).source === '泡泡之盾' && (b as any).hasTriggered
  );
  
  return !hasTriggered;
}

// 标记泡泡之盾已触发
export function markBubbleShieldTriggered(player: PlayerState): void {
  player.tempBuffs.push({
    type: 'BUBBLE_SHIELD_TRIGGERED' as any,
    value: 0,
    duration: 1,
    source: '泡泡之盾',
    hasTriggered: true
  } as any);
}

// #15 独眼小僧「金刚经」🔷
// 【永】你的回合外，所有生命低于5的妖怪生命+1
// 这是一个全局被动效果，在其他玩家回合时生效
export function applyKongoukyouEffect(
  yokaiHp: number,
  isOwnerTurn: boolean,
  hasDoukugan: boolean
): number {
  // 只在非自己回合生效
  if (isOwnerTurn || !hasDoukugan) {
    return yokaiHp;
  }
  
  // 生命低于5的妖怪+1
  if (yokaiHp < 5) {
    return yokaiHp + 1;
  }
  
  return yokaiHp;
}

// #12 食梦貘「沉睡」🔷
// 【启】鬼火-1：抓牌+4，立即结束行动并跳过弃牌与补牌阶段。进入[沉睡]状态
registerSkill('沉睡', async (ctx) => {
  const { player, shikigamiIndex } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 抓牌+4
  drawCards(player, 4);
  
  // 设置沉睡状态标记
  player.tempBuffs.push({
    type: 'SLEEPING' as any,
    value: 0,
    duration: -1, // 持续到下个回合开始
    source: '沉睡',
    skipDiscardPhase: true,
    skipDrawPhase: true
  } as any);
  
  return { 
    success: true, 
    message: '抓牌+4，进入沉睡状态（跳过弃牌与补牌阶段）', 
    costPaid: 1 
  };
});

// 食梦貘：检查是否处于沉睡状态
export function isInSleepingState(player: PlayerState): boolean {
  return player.tempBuffs.some(b => (b as any).source === '沉睡');
}

// 食梦貘：沉睡状态下受到妨害时先弃置1张手牌
export function handleSleepingHarassment(player: PlayerState): boolean {
  if (!isInSleepingState(player)) return true; // 非沉睡状态，正常受到妨害
  
  // 弃置1张手牌
  if (player.hand.length > 0) {
    player.discard.push(player.hand.shift()!);
  }
  
  return true; // 仍然受到妨害效果
}

// 食梦貘：回合开始时清除沉睡状态
export function clearSleepingState(player: PlayerState): void {
  const idx = player.tempBuffs.findIndex(b => (b as any).source === '沉睡');
  if (idx !== -1) {
    player.tempBuffs.splice(idx, 1);
  }
}

// #14 萤草「生花」
// 【启】鬼火-1或弃置1张妖怪牌：放置1枚「祝福种子」指示物（可各1次）
// mode = 0: 消耗鬼火放置种子
// mode = 1: 弃置妖怪牌放置种子
registerSkill('生花', async (ctx, mode) => {
  const { player, shikigamiIndex, onSelectCards } = ctx;
  const state = player.shikigamiState[shikigamiIndex];
  
  if (!state) {
    return { success: false, message: '式神状态异常' };
  }
  
  // 检查本回合是否已使用对应方式
  const usedGhostFire = (state.markers['生花_鬼火'] as boolean) || false;
  const usedYokai = (state.markers['生花_妖怪'] as boolean) || false;
  
  if (mode === 0) {
    // 消耗鬼火放置种子
    if (usedGhostFire) {
      return { success: false, message: '本回合已使用鬼火放置种子' };
    }
    
    if (!payGhostFire(player, 1)) {
      return { success: false, message: '鬼火不足' };
    }
    
    state.markers['生花_鬼火'] = true;
  } else if (mode === 1) {
    // 弃置妖怪牌放置种子
    if (usedYokai) {
      return { success: false, message: '本回合已使用妖怪牌放置种子' };
    }
    
    const yokaiCards = player.hand.filter(c => c.cardType === 'yokai');
    if (yokaiCards.length === 0) {
      return { success: false, message: '没有妖怪牌可弃置' };
    }
    
    let cardId: string;
    if (onSelectCards) {
      const ids = await onSelectCards(yokaiCards, 1);
      cardId = ids[0]!;
    } else {
      cardId = yokaiCards[0]!.instanceId;
    }
    
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      player.discard.push(player.hand.splice(idx, 1)[0]!);
    }
    
    state.markers['生花_妖怪'] = true;
  } else {
    return { success: false, message: '无效的技能模式' };
  }
  
  // 放置种子（无上限）
  const current = (state.markers['祝福种子'] as number) || 0;
  state.markers['祝福种子'] = current + 1;
  
  return { 
    success: true, 
    message: `放置祝福种子（当前${current + 1}枚）`, 
    costPaid: mode === 0 ? 1 : 0 
  };
});

// 萤草：回合开始时移除种子获得效果
export async function activateBlessingSeedsOnTurnStart(
  player: PlayerState,
  shikigamiIndex: number,
  onChoice?: (count: number) => Promise<{ draw: number; damage: number }>
): Promise<{ message: string }> {
  const state = player.shikigamiState[shikigamiIndex];
  if (!state) return { message: '' };
  
  const seeds = (state.markers['祝福种子'] as number) || 0;
  if (seeds === 0) return { message: '' };
  
  // 询问玩家如何分配（每枚可选抓牌+1或伤害+1）
  let drawCount = seeds;
  let damageCount = 0;
  
  if (onChoice) {
    const choice = await onChoice(seeds);
    drawCount = choice.draw;
    damageCount = choice.damage;
  }
  
  // 移除所有种子
  delete state.markers['祝福种子'];
  
  // 应用效果
  for (let i = 0; i < drawCount; i++) {
    drawCards(player, 1);
  }
  player.damage += damageCount;
  
  return { message: `萤草生花：移除${seeds}枚种子，抓牌+${drawCount}，伤害+${damageCount}` };
}

// 萤草：受到妨害时移除种子免疫
export function checkBlessingSeedProtection(
  player: PlayerState,
  shikigamiIndex: number
): boolean {
  const state = player.shikigamiState[shikigamiIndex];
  if (!state) return false;
  
  const seeds = (state.markers['祝福种子'] as number) || 0;
  if (seeds > 0) {
    state.markers['祝福种子'] = seeds - 1;
    if (state.markers['祝福种子'] === 0) {
      delete state.markers['祝福种子'];
    }
    return true; // 免疫妨害
  }
  
  return false;
}

// #10 追月神「明月潮升」
// 【触】在你的回合中，因卡牌效果抓牌达到3张时，可选择一项：· 鬼火+1 · 伤害+1 · 超度1张手牌
// 这是一个触发技能，在抓牌累计达到3张时自动询问玩家
export function checkMoonTideCondition(
  player: PlayerState,
  cardsDrawnThisTurn: number,
  hasZhuiyueshen: boolean
): boolean {
  // 检查是否拥有追月神
  if (!hasZhuiyueshen) return false;
  
  // 检查本回合因卡牌效果抓牌是否达到3张
  // 注意：这里只计算"因卡牌效果"的抓牌，不包括回合开始的正常抓牌
  return cardsDrawnThisTurn >= 3;
}

registerSkill('明月潮升', async (ctx) => {
  const { player, onChoice, onSelectCards } = ctx;
  
  // 让玩家选择效果
  const choiceIndex = onChoice ? await onChoice(['鬼火+1', '伤害+1', '超度1张手牌']) : 0;
  
  switch (choiceIndex) {
    case 0: // 鬼火+1
      player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
      return { success: true, message: '明月潮升：鬼火+1' };
    
    case 1: // 伤害+1
      player.damage += 1;
      return { success: true, message: '明月潮升：伤害+1' };
    
    case 2: // 超度1张手牌
      if (player.hand.length === 0) {
        // 手牌为空，自动选择其他效果
        player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
        return { success: true, message: '明月潮升：无手牌可超度，改为鬼火+1' };
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
      return { success: true, message: '明月潮升：超度1张手牌' };
    
    default:
      return { success: false, message: '无效选择' };
  }
});

// #17 巫蛊师「迷魂蛊」🔷
// 【触】当你超度1张手牌时，鬼火-1：你可以令任一对手展示手牌并用该牌交换其中1张
// 交换的牌张生命差距不大于2（无生命的牌视作生命0）
export function canTriggerMimikongou(
  player: PlayerState,
  exiledCard: CardInstance
): boolean {
  // 检查是否有足够的鬼火
  return player.ghostFire >= 1;
}

registerSkill('迷魂蛊', async (ctx) => {
  const { player, gameState, onSelectTarget, onSelectCards } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  // 获取对手列表
  const opponents = gameState.players.filter(p => p.id !== player.id && p.hand.length > 0);
  
  if (opponents.length === 0) {
    player.ghostFire += 1; // 退还
    return { success: false, message: '没有可交换的对手' };
  }
  
  // 选择对手（简化处理，选第一个）
  const targetPlayer = opponents[0]!;
  
  // 选择自己的手牌进行交换
  if (player.hand.length === 0) {
    player.ghostFire += 1;
    return { success: false, message: '没有手牌可交换' };
  }
  
  let myCardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, 1);
    myCardId = ids[0]!;
  } else {
    myCardId = player.hand[0]!.instanceId;
  }
  
  const myCardIdx = player.hand.findIndex(c => c.instanceId === myCardId);
  if (myCardIdx === -1) {
    player.ghostFire += 1;
    return { success: false, message: '选择的卡牌无效' };
  }
  
  const myCard = player.hand[myCardIdx]!;
  const myCardHp = myCard.hp || 0;
  
  // 筛选对手手牌中生命差距不大于2的牌
  const validOpponentCards = targetPlayer.hand.filter(c => {
    const opponentHp = c.hp || 0;
    return Math.abs(opponentHp - myCardHp) <= 2;
  });
  
  if (validOpponentCards.length === 0) {
    player.ghostFire += 1;
    return { success: false, message: '对手没有符合条件的卡牌（生命差距需≤2）' };
  }
  
  // 选择对手的牌（简化处理，选第一张符合条件的）
  const opponentCard = validOpponentCards[0]!;
  const opponentCardIdx = targetPlayer.hand.findIndex(c => c.instanceId === opponentCard.instanceId);
  
  // 执行交换
  player.hand.splice(myCardIdx, 1);
  targetPlayer.hand.splice(opponentCardIdx, 1);
  
  player.hand.push(opponentCard);
  targetPlayer.hand.push(myCard);
  
  return { 
    success: true, 
    message: `迷魂蛊：用${myCard.name}交换了对手的${opponentCard.name}`, 
    costPaid: 1 
  };
});

// #19 丑时之女「草人替身」🔷
// 【触】本回合中，当你首次进行妨害时，抓牌+1
// 【启】[妨害] 鬼火-2：选择1张手牌给予一名对手，其他对手获得1张「恶评」牌
export function checkStrawDollTrigger(player: PlayerState): boolean {
  // 检查本回合是否已触发过
  return !player.tempBuffs.some(b => (b as any).source === '草人替身_触发');
}

export function triggerStrawDollDraw(player: PlayerState): void {
  if (checkStrawDollTrigger(player)) {
    drawCards(player, 1);
    player.tempBuffs.push({
      type: 'STRAW_DOLL_TRIGGERED' as any,
      value: 0,
      duration: 1,
      source: '草人替身_触发'
    } as any);
  }
}

registerSkill('草人替身', async (ctx) => {
  const { player, gameState, onSelectCards, onSelectTarget } = ctx;
  
  if (!payGhostFire(player, 2)) {
    return { success: false, message: '鬼火不足（需要2点）' };
  }
  
  if (player.hand.length === 0) {
    player.ghostFire += 2;
    return { success: false, message: '没有手牌可给予' };
  }
  
  const opponents = gameState.players.filter(p => p.id !== player.id);
  if (opponents.length === 0) {
    player.ghostFire += 2;
    return { success: false, message: '没有对手' };
  }
  
  // 选择要给出的手牌
  let cardId: string;
  if (onSelectCards) {
    const ids = await onSelectCards(player.hand, 1);
    cardId = ids[0]!;
  } else {
    cardId = player.hand[0]!.instanceId;
  }
  
  const cardIdx = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIdx === -1) {
    player.ghostFire += 2;
    return { success: false, message: '选择的卡牌无效' };
  }
  
  const card = player.hand.splice(cardIdx, 1)[0]!;
  
  // 选择一个对手接收卡牌
  const targetOpponent = opponents[0]!;
  targetOpponent.hand.push(card);
  
  // 其他对手获得1张恶评牌（创建恶评卡牌实例）
  const otherOpponents = opponents.filter(p => p.id !== targetOpponent.id);
  for (const opp of otherOpponents) {
    const penaltyCard: CardInstance = {
      instanceId: `penalty_${Date.now()}_${Math.random()}`,
      cardId: 'penalty_001',
      cardType: 'penalty',
      name: '恶评',
      hp: 0,
      maxHp: 0,
      charm: -1
    };
    opp.hand.push(penaltyCard);
  }
  
  return { 
    success: true, 
    message: `[妨害] 给予对手${card.name}，其他对手各获得1张恶评`, 
    costPaid: 2 
  };
});

// #22 铁鼠「横财护身」🔷
// 【启】[妨害] 鬼火-2：每名对手弃置库顶牌2张牌，若弃置的牌中含有阴阳术，你可以选择其中1张并置入自己的弃牌区
registerSkill('横财护身', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  
  if (!payGhostFire(player, 2)) {
    return { success: false, message: '鬼火不足（需要2点）' };
  }
  
  const opponents = gameState.players.filter(p => p.id !== player.id);
  const spellsDiscarded: CardInstance[] = [];
  
  // 每名对手弃置库顶2张牌
  for (const opp of opponents) {
    for (let i = 0; i < 2 && opp.deck.length > 0; i++) {
      const card = opp.deck.pop()!;
      opp.discard.push(card);
      
      // 记录弃置的阴阳术
      if (card.cardType === 'spell') {
        spellsDiscarded.push(card);
      }
    }
  }
  
  if (spellsDiscarded.length === 0) {
    return { success: true, message: '[妨害] 对手弃置库顶2张牌，无阴阳术', costPaid: 2 };
  }
  
  // 选择1张阴阳术置入自己的弃牌区
  let selectedId: string;
  if (onSelectCards && spellsDiscarded.length > 0) {
    const ids = await onSelectCards(spellsDiscarded, 1);
    selectedId = ids[0]!;
  } else {
    selectedId = spellsDiscarded[0]!.instanceId;
  }
  
  const selectedCard = spellsDiscarded.find(c => c.instanceId === selectedId);
  if (selectedCard) {
    // 从对手弃牌堆移除，加入自己弃牌堆
    for (const opp of opponents) {
      const idx = opp.discard.findIndex(c => c.instanceId === selectedId);
      if (idx !== -1) {
        opp.discard.splice(idx, 1);
        player.discard.push(selectedCard);
        break;
      }
    }
    
    return { 
      success: true, 
      message: `[妨害] 对手弃置库顶2张牌，获取${selectedCard.name}`, 
      costPaid: 2 
    };
  }
  
  return { success: true, message: '[妨害] 对手弃置库顶2张牌', costPaid: 2 };
});

// #16 食发鬼「真实之颜」
// 【启】鬼火-1：选择至多3个场上的游荡妖怪置于妖怪牌库底。立刻补充妖怪且其生命-1
registerSkill('真实之颜', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  
  if (!payGhostFire(player, 1)) {
    return { success: false, message: '鬼火不足' };
  }
  
  const field = gameState.field;
  const yokaiOnField = field.yokaiSlots.filter((y): y is CardInstance => y !== null);
  
  if (yokaiOnField.length === 0) {
    player.ghostFire += 1; // 退还
    return { success: false, message: '场上没有妖怪' };
  }
  
  // 选择至多3个妖怪（这里简化为选择所有，实际实现需要UI交互）
  const toRemove = Math.min(3, yokaiOnField.length);
  const removedYokai: CardInstance[] = [];
  
  for (let i = 0; i < toRemove; i++) {
    // 找到第一个非null的slot
    const slotIndex = field.yokaiSlots.findIndex(y => y !== null);
    if (slotIndex !== -1) {
      const yokai = field.yokaiSlots[slotIndex]!;
      removedYokai.push(yokai);
      field.yokaiSlots[slotIndex] = null;
      // 置于牌库底
      field.yokaiDeck.unshift(yokai);
    }
  }
  
  // 立刻补充妖怪且其生命-1
  const refilled: string[] = [];
  for (let i = 0; i < removedYokai.length; i++) {
    const emptySlot = field.yokaiSlots.findIndex(y => y === null);
    if (emptySlot !== -1 && field.yokaiDeck.length > 0) {
      const newYokai = field.yokaiDeck.pop()!;
      // 生命-1
      newYokai.hp = Math.max(1, (newYokai.hp || newYokai.maxHp || 1) - 1);
      field.yokaiSlots[emptySlot] = newYokai;
      refilled.push(newYokai.name);
    }
  }
  
  return { 
    success: true, 
    message: `移除${removedYokai.length}个妖怪，补充${refilled.length}个妖怪（生命-1）`, 
    costPaid: 1 
  };
});

export { drawCards, payGhostFire };
