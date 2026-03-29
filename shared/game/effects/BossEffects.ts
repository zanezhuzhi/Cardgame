/**
 * 鬼王效果处理器
 * 实现10个鬼王的来袭效果和御魂效果
 */

import { CardInstance, PlayerState, GameState } from '../../types';

// 效果执行结果
interface BossEffectResult {
  success: boolean;
  message: string;
}

// 效果上下文
interface BossEffectContext {
  gameState: GameState;
  bossCard: CardInstance;
  onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
  onChoice?: (options: string[]) => Promise<number>;
  /** 检查玩家是否用青女房防御来袭效果，返回true表示免疫 */
  onCheckBossRaidDefense?: (player: PlayerState, bossName: string) => Promise<boolean>;
  /** 来袭从该玩家起顺时针；缺省为 seats 数组顺序 */
  arrivalStartPlayerId?: string | null;
}

/** 《状态机 spec》：从击败上一鬼王者起顺时针遍历 */
function arrivalPlayerOrder(players: PlayerState[], startId?: string | null): PlayerState[] {
  if (startId == null || startId === '' || players.length === 0) return players;
  const i = players.findIndex(p => p.id === startId);
  if (i <= 0) return players;
  return [...players.slice(i), ...players.slice(0, i)];
}

// 来袭效果处理器
type ArrivalHandler = (ctx: BossEffectContext) => Promise<BossEffectResult>;

// 御魂效果处理器
type SoulHandler = (ctx: BossEffectContext & { player: PlayerState }) => Promise<BossEffectResult>;

// 效果注册表
const arrivalHandlers = new Map<string, ArrivalHandler>();
const soulHandlers = new Map<string, SoulHandler>();

// 注册来袭效果
function registerArrival(name: string, handler: ArrivalHandler): void {
  arrivalHandlers.set(name, handler);
}

// 注册御魂效果
function registerSoul(name: string, handler: SoulHandler): void {
  soulHandlers.set(name, handler);
}

// 执行来袭效果
export async function executeBossArrival(
  bossName: string,
  ctx: BossEffectContext
): Promise<BossEffectResult> {
  const handler = arrivalHandlers.get(bossName);
  if (!handler) {
    return { success: true, message: `${bossName}：无来袭效果` };
  }
  return handler(ctx);
}

// 执行御魂效果
export async function executeBossSoul(
  bossName: string,
  ctx: BossEffectContext & { player: PlayerState }
): Promise<BossEffectResult> {
  const handler = soulHandlers.get(bossName);
  if (!handler) {
    return { success: false, message: `未找到鬼王御魂效果: ${bossName}` };
  }
  return handler(ctx);
}

// 辅助函数：抓牌
function drawCards(player: PlayerState, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count && player.deck.length > 0; i++) {
    player.hand.push(player.deck.pop()!);
    drawn++;
  }
  return drawn;
}

// 辅助函数：检查玩家是否手牌有青女房
function hasQingnvfang(player: PlayerState): boolean {
  return player.hand.some(c => c.cardId === 'yokai_037' || c.name === '青女房');
}

// 辅助函数：获取免疫来袭的玩家列表
async function getImmunePlayers(
  ctx: BossEffectContext,
  bossName: string
): Promise<Set<string>> {
  const immunePlayerIds = new Set<string>();
  
  if (!ctx.onCheckBossRaidDefense) {
    // 无回调时默认自动免疫（向后兼容测试）
    for (const player of ctx.gameState.players) {
      if (hasQingnvfang(player)) {
        immunePlayerIds.add(player.id);
      }
    }
    return immunePlayerIds;
  }
  
  // 有回调时询问每个有青女房的玩家
  for (const player of ctx.gameState.players) {
    if (hasQingnvfang(player)) {
      const isImmune = await ctx.onCheckBossRaidDefense(player, bossName);
      if (isImmune) {
        immunePlayerIds.add(player.id);
      }
    }
  }
  
  return immunePlayerIds;
}

// 辅助函数：创建恶评卡
function createPenaltyCard(): CardInstance {
  return {
    instanceId: `penalty_${Date.now()}_${Math.random()}`,
    cardId: 'penalty_001',
    cardType: 'penalty',
    name: '恶评',
    hp: 0,
    maxHp: 0,
    charm: -1,
    image: ''
  };
}

// ============================================
// 阶段Ⅰ 鬼王
// ============================================

// 麒麟 - 无来袭效果（首张鬼王）
registerArrival('麒麟', async () => {
  return { success: true, message: '麒麟：首张鬼王，无来袭效果' };
});

// 麒麟御魂 - 伤害+3
registerSoul('麒麟', async (ctx) => {
  const { player } = ctx;
  player.damage += 3;
  return { success: true, message: '麒麟：伤害+3' };
});

// 石距 - 来袭：每位玩家弃掉所有阴阳术，未弃牌者获得恶评
registerArrival('石距', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '石距');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    const spells = player.hand.filter(c => c.cardType === 'spell');
    
    if (spells.length > 0) {
      // 弃掉所有阴阳术
      for (const spell of spells) {
        const idx = player.hand.findIndex(c => c.instanceId === spell.instanceId);
        if (idx !== -1) {
          player.discard.push(player.hand.splice(idx, 1)[0]!);
        }
      }
    } else {
      // 无阴阳术，获得恶评
      player.hand.push(createPenaltyCard());
    }
  }
  
  return { success: true, message: '石距来袭：所有玩家弃掉阴阳术' };
});

// 石距御魂 - 鬼火+1，抓牌+1，伤害+2
registerSoul('石距', async (ctx) => {
  const { player } = ctx;
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  drawCards(player, 1);
  player.damage += 2;
  return { success: true, message: '石距：鬼火+1，抓牌+1，伤害+2' };
});

// 鬼灵歌伎🔷 - 来袭：展示牌库顶5张，弃置生命>6的牌
registerArrival('鬼灵歌伎', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '鬼灵歌伎');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    const revealed: CardInstance[] = [];
    const toDiscard: CardInstance[] = [];
    
    // 展示牌库顶5张
    for (let i = 0; i < 5 && player.deck.length > 0; i++) {
      revealed.push(player.deck.pop()!);
    }
    
    // 弃置生命>6的牌
    for (const card of revealed) {
      if ((card.hp || 0) > 6) {
        toDiscard.push(card);
        player.discard.push(card);
      } else {
        // 放回牌库顶
        player.deck.push(card);
      }
    }
  }
  
  return { success: true, message: '鬼灵歌伎来袭：弃置牌库顶生命>6的牌' };
});

// 鬼灵歌伎御魂 - 对手选择：弃牌或你抓牌
registerSoul('鬼灵歌伎', async (ctx) => {
  const { player, gameState } = ctx;
  
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    
    if (p.hand.length > 0) {
      // 随机弃1张（简化处理）
      const randomIdx = Math.floor(Math.random() * p.hand.length);
      p.discard.push(p.hand.splice(randomIdx, 1)[0]!);
    } else {
      // 无手牌，你抓牌+1
      drawCards(player, 1);
    }
  }
  
  return { success: true, message: '鬼灵歌伎：对手弃牌或你抓牌' };
});

// 土蜘蛛 - 来袭：每位玩家展示3张阴阳术，缺1张弃1张手牌
registerArrival('土蜘蛛', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '土蜘蛛');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    const spells = player.hand.filter(c => c.cardType === 'spell');
    const spellCount = spells.length;
    const missing = Math.max(0, 3 - spellCount);
    
    // 每缺1张阴阳术弃1张手牌
    for (let i = 0; i < missing && player.hand.length > 0; i++) {
      player.discard.push(player.hand.shift()!);
    }
  }
  
  return { success: true, message: '土蜘蛛来袭：缺阴阳术者弃牌' };
});

// 土蜘蛛御魂 - 抓牌+2，伤害+3
registerSoul('土蜘蛛', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 2);
  player.damage += 3;
  return { success: true, message: '土蜘蛛：抓牌+2，伤害+3' };
});

// ============================================
// 阶段Ⅱ 鬼王
// ============================================

// 胧车 - 来袭：每位玩家超度1张御魂，无法执行者获得恶评
registerArrival('胧车', async (ctx) => {
  const { gameState, onSelectCards } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '胧车');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    const yokais = player.hand.filter(c => c.cardType === 'yokai');
    
    if (yokais.length > 0) {
      // 超度1张御魂
      let cardId: string;
      if (onSelectCards) {
        const ids = await onSelectCards(yokais, 1);
        cardId = ids[0]!;
      } else {
        cardId = yokais[0]!.instanceId;
      }
      
      const idx = player.hand.findIndex(c => c.instanceId === cardId);
      if (idx !== -1) {
        player.exiled.push(player.hand.splice(idx, 1)[0]!);
      }
    } else {
      // 无御魂，获得恶评
      player.hand.push(createPenaltyCard());
    }
  }
  
  return { success: true, message: '胧车来袭：每位玩家超度1张御魂' };
});

// 胧车御魂 - 抓牌+1，伤害+3
registerSoul('胧车', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  player.damage += 3;
  return { success: true, message: '胧车：抓牌+1，伤害+3' };
});

// 蜃气楼 - 来袭：每位玩家弃置手牌中生命>6的牌
registerArrival('蜃气楼', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '蜃气楼');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    const toDiscard = player.hand.filter(c => (c.hp || 0) > 6);
    
    for (const card of toDiscard) {
      const idx = player.hand.findIndex(c => c.instanceId === card.instanceId);
      if (idx !== -1) {
        player.discard.push(player.hand.splice(idx, 1)[0]!);
      }
    }
  }
  
  return { success: true, message: '蜃气楼来袭：弃置手牌中生命>6的牌' };
});

// 蜃气楼御魂 - 抓牌+1，鬼火+1，伤害+1
registerSoul('蜃气楼', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
  player.damage += 1;
  return { success: true, message: '蜃气楼：抓牌+1，鬼火+1，伤害+1' };
});

// 荒骷髅🔷 - 来袭：牌库全弃，超度生命>7的御魂，获得恶评，重洗
registerArrival('荒骷髅', async (ctx) => {
  const { gameState, onSelectCards } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '荒骷髅');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    // 将整个牌库弃置
    while (player.deck.length > 0) {
      player.discard.push(player.deck.pop()!);
    }
    
    // 超度1张生命>7的御魂
    const validCards = player.discard.filter(c => 
      c.cardType === 'yokai' && (c.hp || 0) > 7
    );
    
    if (validCards.length > 0) {
      let cardId: string;
      if (onSelectCards) {
        const ids = await onSelectCards(validCards, 1);
        cardId = ids[0]!;
      } else {
        cardId = validCards[0]!.instanceId;
      }
      
      const idx = player.discard.findIndex(c => c.instanceId === cardId);
      if (idx !== -1) {
        player.exiled.push(player.discard.splice(idx, 1)[0]!);
      }
    }
    
    // 获得恶评
    player.hand.push(createPenaltyCard());
    
    // 重洗牌库
    player.deck = [...player.discard];
    player.discard = [];
    // 洗牌
    for (let i = player.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [player.deck[i], player.deck[j]] = [player.deck[j]!, player.deck[i]!];
    }
  }
  
  return { success: true, message: '荒骷髅来袭：牌库全弃，超度高生命御魂，获得恶评' };
});

// 荒骷髅御魂 - 抓牌+1，本回合所有卡视作中级符咒
registerSoul('荒骷髅', async (ctx) => {
  const { player } = ctx;
  drawCards(player, 1);
  
  player.tempBuffs.push({
    type: 'TREAT_AS_SPELL' as any,
    value: 0,
    duration: 1,
    source: '荒骷髅'
  } as any);
  
  return { success: true, message: '荒骷髅：抓牌+1，本回合卡牌视作中级符咒' };
});

// ============================================
// 阶段Ⅲ 鬼王
// ============================================

// 地震鲶 - 来袭：清理阶段后随机放置1张手牌到阴阳师下
registerArrival('地震鲶', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '地震鲶');
  
  // 标记地震鲶效果生效（仅对未免疫的玩家）
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    player.tempBuffs.push({
      type: 'EARTHQUAKE_CATFISH' as any,
      value: 0,
      duration: -1, // 持续到鬼王被击败
      source: '地震鲶'
    } as any);
  }
  
  return { success: true, message: '地震鲶来袭：清理阶段后需放置手牌到阴阳师下' };
});

// 地震鲶御魂 - 对手弃至3张，你可获得最高生命御魂
registerSoul('地震鲶', async (ctx) => {
  const { player, gameState, onSelectCards } = ctx;
  
  const allDiscardedYokai: CardInstance[] = [];
  
  for (const p of gameState.players) {
    if (p.id === player.id) continue;
    
    // 弃至3张
    while (p.hand.length > 3) {
      const card = p.hand.pop()!;
      p.discard.push(card);
      
      if (card.cardType === 'yokai') {
        allDiscardedYokai.push(card);
      }
    }
  }
  
  // 获得生命最高的御魂
  if (allDiscardedYokai.length > 0) {
    allDiscardedYokai.sort((a, b) => (b.hp || 0) - (a.hp || 0));
    const bestYokai = allDiscardedYokai[0]!;
    
    // 从对手弃牌堆移除，加入你手牌
    for (const p of gameState.players) {
      const idx = p.discard.findIndex(c => c.instanceId === bestYokai.instanceId);
      if (idx !== -1) {
        p.discard.splice(idx, 1);
        player.hand.push(bestYokai);
        break;
      }
    }
    
    return { success: true, message: `地震鲶：对手弃至3张，获得${bestYokai.name}` };
  }
  
  return { success: true, message: '地震鲶：对手弃至3张' };
});

// 八岐大蛇 - 来袭：弃掉生命最高的手牌，式神失去能力
registerArrival('八岐大蛇', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '八岐大蛇');
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    if (player.hand.length > 0) {
      // 找出生命最高的牌
      let maxHp = -1;
      let maxIdx = 0;
      
      for (let i = 0; i < player.hand.length; i++) {
        const hp = player.hand[i]!.hp || 0;
        if (hp > maxHp) {
          maxHp = hp;
          maxIdx = i;
        }
      }
      
      player.discard.push(player.hand.splice(maxIdx, 1)[0]!);
    }
    
    // 式神翻面失去能力
    for (let i = 0; i < player.shikigamiState.length; i++) {
      player.shikigamiState[i] = {
        ...player.shikigamiState[i],
        flipped: true
      } as any;
    }
  }
  
  return { success: true, message: '八岐大蛇来袭：弃最高生命手牌，式神失去能力' };
});

// 八岐大蛇御魂 - 鬼火+2，伤害+7
registerSoul('八岐大蛇', async (ctx) => {
  const { player } = ctx;
  player.ghostFire = Math.min(player.ghostFire + 2, player.maxGhostFire);
  player.damage += 7;
  return { success: true, message: '八岐大蛇：鬼火+2，伤害+7' };
});

// 贪嗔痴🔷 - 来袭：随机弃1张，生命最高的玩家再弃1张
registerArrival('贪嗔痴', async (ctx) => {
  const { gameState } = ctx;
  const immunePlayers = await getImmunePlayers(ctx, '贪嗔痴');
  
  let maxHp = -1;
  let maxPlayers: PlayerState[] = [];
  
  for (const player of arrivalPlayerOrder(gameState.players, ctx.arrivalStartPlayerId)) {
    // 检查青女房免疫
    if (immunePlayers.has(player.id)) {
      continue;
    }
    
    // 随机弃1张
    if (player.hand.length > 0) {
      const randomIdx = Math.floor(Math.random() * player.hand.length);
      player.discard.push(player.hand.splice(randomIdx, 1)[0]!);
    }
    
    // 计算手牌总生命
    const totalHp = player.hand.reduce((sum, c) => sum + (c.hp || 0), 0);
    
    if (totalHp > maxHp) {
      maxHp = totalHp;
      maxPlayers = [player];
    } else if (totalHp === maxHp) {
      maxPlayers.push(player);
    }
  }
  
  // 生命最高的玩家再弃1张（也需要检查免疫）
  for (const player of maxPlayers) {
    if (immunePlayers.has(player.id)) {
      continue;
    }
    if (player.hand.length > 0) {
      player.discard.push(player.hand.shift()!);
    }
  }
  
  return { success: true, message: '贪嗔痴来袭：随机弃牌，生命最高者再弃1张' };
});

// 贪嗔痴御魂 - 抓牌+1，超度手牌造成等同伤害
registerSoul('贪嗔痴', async (ctx) => {
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
      const card = player.hand.splice(idx, 1)[0]!;
      player.exiled.push(card);
      const damage = card.hp || 0;
      player.damage += damage;
      
      return { success: true, message: `贪嗔痴：抓牌+1，超度${card.name}，伤害+${damage}` };
    }
  }
  
  return { success: true, message: '贪嗔痴：抓牌+1' };
});

// ============================================
// 【自】回合开始时回收辅助函数
// ============================================

// 检查弃牌堆中是否有可回收的鬼王
export function checkBossRecoveryOnTurnStart(player: PlayerState): CardInstance | null {
  const recoverableBosses = ['蜃气楼', '荒骷髅', '贪嗔痴'];
  
  for (const card of player.discard) {
    if (card.cardType === 'boss' && recoverableBosses.includes(card.name)) {
      return card;
    }
  }
  
  return null;
}

// 执行回收
export function recoverBossToHand(player: PlayerState, card: CardInstance): boolean {
  const idx = player.discard.findIndex(c => c.instanceId === card.instanceId);
  if (idx !== -1) {
    player.hand.push(player.discard.splice(idx, 1)[0]!);
    return true;
  }
  return false;
}

// ============================================
// 【触】麒麟回合结束归底
// ============================================
export function checkKirinEndOfTurn(player: PlayerState): boolean {
  const kirinIdx = player.discard.findIndex(c => c.name === '麒麟');
  if (kirinIdx !== -1) {
    player.deck.unshift(player.discard.splice(kirinIdx, 1)[0]!);
    return true;
  }
  return false;
}

// ============================================
// 清除八岐大蛇的式神翻面状态
// ============================================
export function clearOrochiEffect(gameState: GameState): void {
  for (const player of gameState.players) {
    for (let i = 0; i < player.shikigamiState.length; i++) {
      if ((player.shikigamiState[i] as any)?.flipped) {
        player.shikigamiState[i] = {
          ...player.shikigamiState[i],
          flipped: false
        } as any;
      }
    }
  }
}

// ============================================
// 清除地震鲶效果并弃置阴阳师下的牌
// ============================================
export function clearEarthquakeCatfishEffect(gameState: GameState): void {
  for (const player of gameState.players) {
    // 移除buff
    const buffIdx = player.tempBuffs.findIndex(b => (b as any).source === '地震鲶');
    if (buffIdx !== -1) {
      player.tempBuffs.splice(buffIdx, 1);
    }
    
    const hidden = (player as any).cardsUnderOnmyoji as CardInstance[] | undefined;
    if (hidden && hidden.length > 0) {
      for (const c of hidden) {
        player.discard.push(c);
      }
      (player as any).cardsUnderOnmyoji = [];
    }
    const legacy = (player as any).hiddenCards as CardInstance[] | undefined;
    if (legacy && legacy.length > 0) {
      for (const c of legacy) {
        player.discard.push(c);
      }
      (player as any).hiddenCards = [];
    }
  }
}

export { drawCards, createPenaltyCard, arrivalHandlers, soulHandlers };
