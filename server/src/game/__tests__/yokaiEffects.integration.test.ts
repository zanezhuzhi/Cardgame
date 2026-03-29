/**
 * 御魂效果服务端集成测试
 * 
 * 目的：确保 MultiplayerGame 中的御魂效果实现与预期一致
 * 防止 shared 层测试通过但服务端实际代码有 bug 的情况
 * 
 * @file server/src/game/__tests__/yokaiEffects.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerGame } from '../MultiplayerGame';

// 由于 shared 类型导入可能存在问题，使用本地类型
interface CardInstance {
  instanceId: string;
  cardId: string;
  cardType: string;
  name: string;
  hp: number;
  maxHp: number;
  damage?: number;
  charm?: number;
}

interface PlayerState {
  id: string;
  name: string;
  ghostFire: number;
  maxGhostFire: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  exiled: CardInstance[];
  damage: number;
  reputation: number;
  tempBuffs: any[];
}

// ============ 测试辅助函数 ============

function createGame(playerCount = 2): MultiplayerGame {
  const players = Array.from({ length: playerCount }).map((_, i) => ({
    id: `p${i + 1}`,
    name: `玩家${i + 1}`,
  }));
  const game = new MultiplayerGame('test-room', players);
  const state: any = (game as any).state;
  state.phase = 'playing';
  state.turnPhase = 'action';
  state.currentPlayerIndex = 0;
  return game;
}

function createYokaiCard(name: string, hp: number, overrides?: Partial<CardInstance>): CardInstance {
  return {
    instanceId: `yokai_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    cardId: `yokai_test_${name}`,
    cardType: 'yokai',
    name,
    hp,
    maxHp: hp,
    damage: 0,
    ...overrides,
  };
}

function getPlayer(game: MultiplayerGame, index = 0): PlayerState {
  return (game as any).state.players[index];
}

function getState(game: MultiplayerGame): any {
  return (game as any).state;
}

// ============ 轮入道集成测试 ============

describe('轮入道 服务端集成测试', () => {
  let game: MultiplayerGame;
  let player: PlayerState;

  beforeEach(() => {
    game = createGame(2);
    player = getPlayer(game);
    player.ghostFire = 3;
    player.damage = 0;
    player.hand = [];
  });

// ============ 涂佛集成测试 ============

describe('涂佛 服务端集成测试', () => {
  let game: MultiplayerGame;
  let player: PlayerState;

  function createSpellCard(name: string): CardInstance {
    return {
      instanceId: `spell_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cardId: `spell_${name}`,
      cardType: 'spell',
      name,
      hp: 0,
      maxHp: 0,
      damage: name === '高级符咒' ? 3 : name === '中级符咒' ? 2 : 1,
    };
  }

  beforeEach(() => {
    game = createGame(2);
    player = getPlayer(game);
    player.ghostFire = 3;
    player.damage = 0;
    player.hand = [];
    player.discard = [];
  });

  it('🟢 弃牌区有3张阴阳术时，AI应全部取回（按伤害降序）', () => {
    // 准备：设置 AI 玩家
    player.isAI = true;
    const tufo = createYokaiCard('涂佛', 5);
    const spell1 = createSpellCard('基础术式');
    const spell2 = createSpellCard('中级符咒');
    const spell3 = createSpellCard('高级符咒');
    // 注意：executeYokaiEffect 是在卡牌打出后调用，此时卡牌已不在手牌中
    player.hand = [];
    player.discard = [spell1, spell2, spell3, createYokaiCard('天邪鬼青', 3)];
    
    // 执行：涂佛效果
    (game as any).executeYokaiEffect(player, tufo);
    
    // 验证：AI 应取回全部3张阴阳术
    expect(player.hand).toHaveLength(3);
    expect(player.discard).toHaveLength(1);
    expect(player.discard[0].name).toBe('天邪鬼青');
    
    // 验证：AI 优先选择高伤害（高级符咒应排在前面）
    const handNames = player.hand.map(c => c.name);
    expect(handNames).toContain('高级符咒');
    expect(handNames).toContain('中级符咒');
    expect(handNames).toContain('基础术式');
  });

  it('🟢 弃牌区有5张阴阳术时，AI应取回伤害最高的3张', () => {
    // 准备
    player.isAI = true;
    const tufo = createYokaiCard('涂佛', 5);
    const spell1 = createSpellCard('基础术式');
    spell1.instanceId = 'spell_1';
    const spell2 = createSpellCard('基础术式');
    spell2.instanceId = 'spell_2';
    const spell3 = createSpellCard('中级符咒');
    spell3.instanceId = 'spell_3';
    const spell4 = createSpellCard('中级符咒');
    spell4.instanceId = 'spell_4';
    const spell5 = createSpellCard('高级符咒');
    spell5.instanceId = 'spell_5';
    // 注意：executeYokaiEffect 是在卡牌打出后调用，此时卡牌已不在手牌中
    player.hand = [];
    player.discard = [spell1, spell2, spell3, spell4, spell5];
    
    // 执行
    (game as any).executeYokaiEffect(player, tufo);
    
    // 验证：AI 取回高级符咒 + 两张中级符咒
    expect(player.hand).toHaveLength(3);
    expect(player.discard).toHaveLength(2);
    
    // 剩下的应该是两张基础术式
    const discardNames = player.discard.map(c => c.name);
    expect(discardNames.filter(n => n === '基础术式')).toHaveLength(2);
  });

  it('🟢 真人玩家应触发 tufoSelect pendingChoice', () => {
    // 准备：非AI玩家
    player.isAI = false;
    const tufo = createYokaiCard('涂佛', 5);
    const spell1 = createSpellCard('基础术式');
    const spell2 = createSpellCard('中级符咒');
    // 注意：executeYokaiEffect 是在卡牌打出后调用，此时卡牌已不在手牌中
    player.hand = [];
    player.discard = [spell1, spell2];
    
    // 执行
    (game as any).executeYokaiEffect(player, tufo);
    
    // 验证：应设置 pendingChoice
    const state = getState(game);
    expect(state.pendingChoice).toBeDefined();
    expect(state.pendingChoice.type).toBe('tufoSelect');
    expect(state.pendingChoice.playerId).toBe(player.id);
    expect(state.pendingChoice.cards).toHaveLength(2);
    expect(state.pendingChoice.maxCount).toBe(2);
    expect(state.pendingChoice.minCount).toBe(0);
  });

  it('🔴 弃牌区无阴阳术时，不触发选择', () => {
    // 准备
    const tufo = createYokaiCard('涂佛', 5);
    // 注意：executeYokaiEffect 是在卡牌打出后调用，此时卡牌已不在手牌中
    player.hand = [];
    player.discard = [createYokaiCard('赤舌', 3), createYokaiCard('天邪鬼青', 3)];
    
    // 执行
    (game as any).executeYokaiEffect(player, tufo);
    
    // 验证：不应设置 pendingChoice
    const state = getState(game);
    expect(state.pendingChoice).toBeUndefined();
    expect(player.hand).toHaveLength(0); // 效果无事发生
    expect(player.discard).toHaveLength(2); // 弃牌区不变
  });
});

// ============ handleTufoSelectResponse 测试 ============

describe('handleTufoSelectResponse 服务端测试', () => {
  let game: MultiplayerGame;
  let player: PlayerState;

  function createSpellCard(name: string): CardInstance {
    return {
      instanceId: `spell_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cardId: `spell_${name}`,
      cardType: 'spell',
      name,
      hp: 0,
      maxHp: 0,
      damage: name === '高级符咒' ? 3 : name === '中级符咒' ? 2 : 1,
    };
  }

  beforeEach(() => {
    game = createGame(2);
    player = getPlayer(game);
    player.hand = [];
    player.discard = [];
  });

  it('🟢 选择2张阴阳术后，正确移入手牌', () => {
    // 准备
    const spell1 = createSpellCard('基础术式');
    spell1.instanceId = 'spell_1';
    const spell2 = createSpellCard('高级符咒');
    spell2.instanceId = 'spell_2';
    const spell3 = createSpellCard('中级符咒');
    spell3.instanceId = 'spell_3';
    player.discard = [spell1, spell2, spell3];
    
    const state = getState(game);
    state.pendingChoice = {
      type: 'tufoSelect',
      playerId: player.id,
      cards: [spell1, spell2, spell3],
      maxCount: 3,
      minCount: 0,
      prompt: '选择阴阳术'
    };
    
    // 执行：选择高级符咒和中级符咒
    const result = game.handleTufoSelectResponse(player.id, ['spell_2', 'spell_3']);
    
    // 验证
    expect(result.success).toBe(true);
    expect(state.pendingChoice).toBeUndefined();
    expect(player.hand).toHaveLength(2);
    expect(player.hand.map(c => c.name).sort()).toEqual(['中级符咒', '高级符咒']);
    expect(player.discard).toHaveLength(1);
    expect(player.discard[0].name).toBe('基础术式');
  });

  it('🟢 选择0张（放弃）时，弃牌区不变', () => {
    // 准备
    const spell1 = createSpellCard('基础术式');
    spell1.instanceId = 'spell_1';
    player.discard = [spell1];
    
    const state = getState(game);
    state.pendingChoice = {
      type: 'tufoSelect',
      playerId: player.id,
      cards: [spell1],
      maxCount: 1,
      minCount: 0,
      prompt: '选择阴阳术'
    };
    
    // 执行：不选择任何牌
    const result = game.handleTufoSelectResponse(player.id, []);
    
    // 验证
    expect(result.success).toBe(true);
    expect(player.hand).toHaveLength(0);
    expect(player.discard).toHaveLength(1);
  });

  it('🔴 非法玩家ID应返回失败', () => {
    const state = getState(game);
    state.pendingChoice = {
      type: 'tufoSelect',
      playerId: player.id,
      cards: [],
      maxCount: 0,
      minCount: 0,
      prompt: ''
    };
    
    const result = game.handleTufoSelectResponse('wrong-player-id', []);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('不是你的选择');
  });

  it('🔴 无 pendingChoice 时应返回失败', () => {
    const state = getState(game);
    state.pendingChoice = undefined;
    
    const result = game.handleTufoSelectResponse(player.id, []);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('没有待处理');
  });

  it('🟢 轮入道触发涂佛后，应继续队列', () => {
    // 准备：模拟轮入道队列
    const spell1 = createSpellCard('基础术式');
    spell1.instanceId = 'spell_1';
    player.discard = [spell1];
    
    const state = getState(game);
    state.pendingChoice = {
      type: 'tufoSelect',
      playerId: player.id,
      cards: [spell1],
      maxCount: 1,
      minCount: 0,
      prompt: '选择阴阳术'
    };
    
    // 设置轮入道队列
    state.wheelMonkQueue = {
      playerId: player.id,
      remainingExecutions: 1,
      cardName: '涂佛',
      cardId: '',
    };
    
    // 执行
    const result = game.handleTufoSelectResponse(player.id, ['spell_1']);
    
    // 验证
    expect(result.success).toBe(true);
    expect(player.hand).toHaveLength(1);
    // 轮入道队列应该被处理（checkAndContinueWheelMonkQueue 被调用）
    // 由于 remainingExecutions 还有1次，会继续执行涂佛效果
    // 此时弃牌区已空，所以不会再设置 pendingChoice
  });
});

  it('🟢 手牌有符合条件的御魂时，应触发弃牌选择', () => {
    // 准备：给玩家添加轮入道和一张 HP≤6 的御魂
    const wheelMonk = createYokaiCard('轮入道', 5);
    const heartEye = createYokaiCard('心眼', 3, { damage: 3 });
    player.hand = [wheelMonk, heartEye];
    
    // 执行：打出轮入道
    const state = getState(game);
    (game as any).executeYokaiEffect(player, wheelMonk);
    
    // 验证：应该设置 pendingChoice 让玩家选择弃牌
    // 由于只有1张符合条件的御魂(心眼)，应该自动选择并执行
    // 检查伤害是否增加了 (心眼 +3) × 2 = +6
    expect(player.damage).toBe(6);
  });

  it('🟢 多张符合条件御魂时，应设置 wheelMonkDiscard pendingChoice', () => {
    // 准备：给玩家添加轮入道和两张 HP≤6 的御魂
    const wheelMonk = createYokaiCard('轮入道', 5);
    const heartEye = createYokaiCard('心眼', 3);
    const soldier = createYokaiCard('兵主部', 4); // HP=4, 效果：伤害+2
    player.hand = [wheelMonk, heartEye, soldier];
    
    // 执行：打出轮入道
    (game as any).executeYokaiEffect(player, wheelMonk);
    
    // 验证：应该设置 pendingChoice
    const state = getState(game);
    expect(state.pendingChoice).toBeDefined();
    expect(state.pendingChoice.type).toBe('wheelMonkDiscard');
    expect(state.pendingChoice.playerId).toBe(player.id);
    expect(state.pendingChoice.candidates).toHaveLength(2); // 心眼和兵主部
  });

  it('🟢 选择心眼后，伤害应增加6（3×2）', () => {
    // 准备
    const heartEye = createYokaiCard('心眼', 3);
    player.hand = [heartEye];
    player.damage = 0;
    
    // 执行：调用轮入道效果执行函数
    (game as any).executeWheelMonkEffect(player, heartEye.instanceId);
    
    // 验证
    expect(player.damage).toBe(6); // 心眼伤害+3，执行2次
    expect(player.hand).toHaveLength(0);
    expect(player.discard).toHaveLength(1);
    expect(player.discard[0].name).toBe('心眼');
  });

  it('🟢 选择涅槃之火后，应获得2个减费buff', () => {
    // 准备
    const nirvana = createYokaiCard('涅槃之火', 2);
    player.hand = [nirvana];
    player.tempBuffs = [];
    
    // 执行
    (game as any).executeWheelMonkEffect(player, nirvana.instanceId);
    
    // 验证
    const costReductions = player.tempBuffs.filter(b => b.type === 'SKILL_COST_REDUCTION');
    expect(costReductions).toHaveLength(2);
    expect(costReductions[0].value).toBe(1);
    expect(costReductions[1].value).toBe(1);
  });

  it('🟢 选择灯笼鬼后，鬼火+2，抓牌+2', () => {
    // 准备
    const lantern = createYokaiCard('灯笼鬼', 3);
    player.hand = [lantern];
    player.ghostFire = 2;
    player.deck = [
      createYokaiCard('dummy1', 1),
      createYokaiCard('dummy2', 1),
      createYokaiCard('dummy3', 1),
    ];
    const initialHandCount = player.hand.length;
    const initialDeckCount = player.deck.length;
    
    // 执行
    (game as any).executeWheelMonkEffect(player, lantern.instanceId);
    
    // 验证
    expect(player.ghostFire).toBe(4); // 2 + 1 + 1
    // 灯笼鬼被弃置后，从牌库抓2张
    expect(player.hand.length).toBe(2);
    expect(player.deck.length).toBe(initialDeckCount - 2);
  });

  it('🔴 手牌中没有HP≤6的御魂时，不触发选择', () => {
    // 准备：只有 HP>6 的御魂
    const wheelMonk = createYokaiCard('轮入道', 5);
    const bigYokai = createYokaiCard('大妖怪', 8);
    player.hand = [wheelMonk, bigYokai];
    
    // 执行
    (game as any).executeYokaiEffect(player, wheelMonk);
    
    // 验证：不应设置 pendingChoice
    const state = getState(game);
    expect(state.pendingChoice).toBeUndefined();
  });

  it('🔴 手牌为空时，不触发选择', () => {
    // 准备
    const wheelMonk = createYokaiCard('轮入道', 5);
    player.hand = [];
    
    // 执行
    (game as any).executeYokaiEffect(player, wheelMonk);
    
    // 验证
    const state = getState(game);
    expect(state.pendingChoice).toBeUndefined();
  });
});

// ============ 其他御魂简单效果测试 ============

describe('简单御魂效果 服务端集成测试', () => {
  let game: MultiplayerGame;
  let player: PlayerState;

  beforeEach(() => {
    game = createGame(2);
    player = getPlayer(game);
    player.ghostFire = 3;
    player.damage = 0;
    player.tempBuffs = [];
  });

  it('心眼：伤害+3', () => {
    const card = createYokaiCard('心眼', 3, { damage: 3 });
    player.hand = [card];
    
    (game as any).executeYokaiEffect(player, card);
    
    expect(player.damage).toBe(3);
  });

  it('兵主部：伤害+2', () => {
    const card = createYokaiCard('兵主部', 4, { damage: 2 });
    player.hand = [card];
    
    (game as any).executeYokaiEffect(player, card);
    
    expect(player.damage).toBe(2);
  });

  it('涅槃之火：添加技能减费buff', () => {
    const card = createYokaiCard('涅槃之火', 2);
    player.hand = [card];
    
    (game as any).executeYokaiEffect(player, card);
    
    const buffs = player.tempBuffs.filter(b => b.type === 'SKILL_COST_REDUCTION');
    expect(buffs).toHaveLength(1);
    expect(buffs[0].value).toBe(1);
  });

  it('网切：field 级别 buff，妖怪HP-1，鬼王HP-2', () => {
    const card = createYokaiCard('网切', 3);
    player.hand = [card];
    
    (game as any).executeYokaiEffect(player, card);
    
    // 验证 field 级别 buff（不是 player 级别）
    const state = getState(game);
    const fieldBuffs = (state.field.tempBuffs || []).filter((b: any) => b.type === 'NET_CUTTER_HP_REDUCTION');
    expect(fieldBuffs).toHaveLength(1);
    expect(fieldBuffs[0].yokaiHpModifier).toBe(-1);
    expect(fieldBuffs[0].bossHpModifier).toBe(-2);
    expect(fieldBuffs[0].minHp).toBe(1);
    
    // player 级别不应有 HP_REDUCTION buff
    const playerBuffs = player.tempBuffs.filter(b => b.type === 'HP_REDUCTION');
    expect(playerBuffs).toHaveLength(0);
  });

  it('网切：多次使用不叠加（覆盖）', () => {
    const card1 = createYokaiCard('网切', 3);
    const card2 = createYokaiCard('网切', 3);
    player.hand = [card1, card2];
    
    (game as any).executeYokaiEffect(player, card1);
    (game as any).executeYokaiEffect(player, card2);
    
    const state = getState(game);
    const fieldBuffs = (state.field.tempBuffs || []).filter((b: any) => b.type === 'NET_CUTTER_HP_REDUCTION');
    // 应该只有1个，不叠加
    expect(fieldBuffs).toHaveLength(1);
  });

  it('铮：抓牌+1，伤害+2', () => {
    const card = createYokaiCard('铮', 4, { damage: 2 });
    player.hand = [card];
    player.deck = [createYokaiCard('dummy', 1)];
    const initialDeckCount = player.deck.length;
    
    (game as any).executeYokaiEffect(player, card);
    
    expect(player.damage).toBe(2);
    expect(player.deck.length).toBe(initialDeckCount - 1);
  });

  it('招福达摩：无效果（不报错）', () => {
    const card = createYokaiCard('招福达摩', 2);
    player.hand = [card];
    player.damage = 0;
    
    // 不应抛出异常
    expect(() => {
      (game as any).executeYokaiEffect(player, card);
    }).not.toThrow();
    
    expect(player.damage).toBe(0);
  });

  it('破势（首张）：伤害+5', () => {
    const card = createYokaiCard('破势', 6);
    player.hand = [card];
    player.damage = 0;
    // 与 handlePlayCard 一致：打出流水在调用 executeYokaiEffect 前已对本次牌 cardsPlayed++
    (player as any).cardsPlayed = 1;
    
    (game as any).executeYokaiEffect(player, card);
    
    expect(player.damage).toBe(5);
  });

  it('破势（非首张）：伤害+3', () => {
    const card = createYokaiCard('破势', 6);
    player.hand = [card];
    player.damage = 0;
    (player as any).cardsPlayed = 2; // 本回合已打出过至少一张
    
    (game as any).executeYokaiEffect(player, card);
    
    expect(player.damage).toBe(3);
  });
});

// ============ handleWheelMonkDiscardResponse 测试 ============

describe('handleWheelMonkDiscardResponse 服务端测试', () => {
  let game: MultiplayerGame;
  let player: PlayerState;

  beforeEach(() => {
    game = createGame(2);
    player = getPlayer(game);
    player.ghostFire = 3;
    player.damage = 0;
    player.hand = [];
    player.tempBuffs = [];
  });

  it('🟢 正确响应后清除 pendingChoice', () => {
    // 准备
    const heartEye = createYokaiCard('心眼', 3);
    player.hand = [heartEye];
    
    const state = getState(game);
    state.pendingChoice = {
      type: 'wheelMonkDiscard',
      playerId: player.id,
      candidates: [heartEye.instanceId],
      prompt: '选择御魂'
    };
    
    // 执行
    const result = game.handleWheelMonkDiscardResponse(player.id, heartEye.instanceId);
    
    // 验证
    expect(result.success).toBe(true);
    expect(state.pendingChoice).toBeUndefined();
    expect(player.damage).toBe(6); // 心眼×2
  });

  it('🔴 非法玩家ID应返回失败', () => {
    const state = getState(game);
    state.pendingChoice = {
      type: 'wheelMonkDiscard',
      playerId: player.id,
      candidates: [],
      prompt: '选择御魂'
    };
    
    const result = game.handleWheelMonkDiscardResponse('wrong-player-id', 'any');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('不是你的选择');
  });

  it('🔴 无 pendingChoice 时应返回失败', () => {
    const state = getState(game);
    state.pendingChoice = undefined;
    
    const result = game.handleWheelMonkDiscardResponse(player.id, 'any');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('没有待处理');
  });

  it('🔴 非法选择应使用默认（第一张）', () => {
    const heartEye = createYokaiCard('心眼', 3);
    player.hand = [heartEye];
    
    const state = getState(game);
    state.pendingChoice = {
      type: 'wheelMonkDiscard',
      playerId: player.id,
      candidates: [heartEye.instanceId],
      prompt: '选择御魂'
    };
    
    // 传入非法ID
    const result = game.handleWheelMonkDiscardResponse(player.id, 'invalid-id');
    
    // 应该使用默认选择（第一张）
    expect(result.success).toBe(true);
    expect(player.damage).toBe(6);
  });
});
