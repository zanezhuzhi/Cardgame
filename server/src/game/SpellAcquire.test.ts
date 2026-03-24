/**
 * 获得阴阳术 - 自动化测试
 * TDD Red/Green 测试
 */

import { MultiplayerGame } from './MultiplayerGame';

// 模拟玩家信息
const mockPlayers = [
  { id: 'player1', name: '测试玩家1' },
  { id: 'player2', name: '测试玩家2' },
];

// 创建测试用的卡牌
function createSpellCard(damage: number, name: string, cardId: string) {
  return {
    instanceId: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId,
    cardType: 'spell' as const,
    name,
    damage,
    hp: damage,
    charm: 0,
    effect: '',
    image: '',
  };
}

function createYokaiCard(hp: number, name: string) {
  return {
    instanceId: `yokai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId: `yokai_test_${hp}`,
    cardType: 'yokai' as const,
    name,
    hp,
    maxHp: hp,
    damage: 0,
    charm: 1,
    effect: '',
    image: '',
  };
}

// 测试结果收集
const testResults: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    testResults.push({ name, passed: true });
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    testResults.push({ name, passed: false, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============ 测试套件 ============

console.log('\n════════════════════════════════════════════');
console.log('  获得阴阳术 - TDD 测试');
console.log('════════════════════════════════════════════\n');

// 创建游戏实例
const game = new MultiplayerGame('test-room', mockPlayers as any);

// 跳过式神选择阶段，直接开始游戏
(game as any).state.phase = 'playing';
(game as any).state.turnPhase = 'action';
(game as any).state.currentPlayerIndex = 0;

// 获取玩家引用
const player1 = (game as any).state.players[0];

console.log('【一、基础术式测试】\n');

test('1-1: 行动阶段可以获得基础术式', () => {
  // 重置状态
  player1.hasGainedBasicSpell = false;
  player1.discard = [];
  (game as any).state.turnPhase = 'action';
  
  const result = (game as any).handleGainBasicSpell('player1');
  
  assertTrue(result.success, `应该成功，实际: ${result.error}`);
  assertEqual(player1.discard.length, 1, '弃牌堆应有1张牌');
  assertEqual(player1.discard[0].name, '基础术式', '应该是基础术式');
  assertEqual(player1.discard[0].damage, 1, '伤害应该是1');
});

test('1-2: 本回合已获得基础术式不能再次获得', () => {
  // player1.hasGainedBasicSpell 已经是 true
  
  const result = (game as any).handleGainBasicSpell('player1');
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('已获得'), `错误信息应包含"已获得"，实际: ${result.error}`);
});

test('1-3: 非行动阶段不能获得基础术式', () => {
  player1.hasGainedBasicSpell = false;
  (game as any).state.turnPhase = 'draw';
  
  const result = (game as any).handleGainBasicSpell('player1');
  
  assertTrue(!result.success, '应该失败');
  (game as any).state.turnPhase = 'action';  // 恢复
});

console.log('\n【二、中级符咒测试】\n');

test('2-1: 手牌无基础术式不能兑换中级符咒', () => {
  player1.hand = [];
  player1.discard = [createYokaiCard(3, '测试妖怪')];
  (player1 as any).hasGainedMediumSpell = false;
  
  const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('基础术式'), `错误信息应包含"基础术式"，实际: ${result.error}`);
});

test('2-2: 弃牌堆无符合条件妖怪不能兑换中级符咒', () => {
  player1.hand = [createSpellCard(1, '基础术式', 'spell_001')];
  player1.discard = [createYokaiCard(1, '弱小妖怪')];  // hp=1 < 2
  (player1 as any).hasGainedMediumSpell = false;
  
  const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('生命值不足'), `错误信息应包含"生命值不足"，实际: ${result.error}`);
});

test('2-3: 满足条件可以兑换中级符咒', () => {
  const basicSpell = createSpellCard(1, '基础术式', 'spell_001');
  const yokai = createYokaiCard(3, '符合条件妖怪');
  
  player1.hand = [basicSpell];
  player1.discard = [yokai];
  player1.exiled = [];
  (player1 as any).hasGainedMediumSpell = false;
  
  const yokaiId = yokai.instanceId;
  const result = (game as any).handleExchangeMediumSpell('player1', yokaiId);
  
  assertTrue(result.success, `应该成功，实际: ${result.error}`);
  assertEqual(player1.hand.length, 0, '手牌应该被清空');
  assertEqual(player1.exiled.length, 2, '超度区应有2张牌');
  assertEqual(player1.discard.length, 1, '弃牌堆应有1张牌');
  assertEqual(player1.discard[0].name, '中级符咒', '应该是中级符咒');
  assertEqual(player1.discard[0].damage, 2, '伤害应该是2');
});

test('2-4: 本回合已兑换中级符咒不能再次兑换', () => {
  player1.hand = [createSpellCard(1, '基础术式', 'spell_001')];
  player1.discard = [createYokaiCard(3, '另一个妖怪')];
  // hasGainedMediumSpell 已经是 true
  
  const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('已兑换'), `错误信息应包含"已兑换"，实际: ${result.error}`);
});

console.log('\n【三、高级符咒测试】\n');

test('3-1: 手牌无中级符咒不能兑换高级符咒', () => {
  player1.hand = [];
  player1.discard = [createYokaiCard(5, '强力妖怪')];
  (player1 as any).hasGainedAdvancedSpell = false;
  
  const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('中级符咒'), `错误信息应包含"中级符咒"，实际: ${result.error}`);
});

test('3-2: 弃牌堆妖怪生命<4不能兑换高级符咒', () => {
  player1.hand = [createSpellCard(2, '中级符咒', 'spell_002')];
  player1.discard = [createYokaiCard(3, '普通妖怪')];  // hp=3 < 4
  (player1 as any).hasGainedAdvancedSpell = false;
  
  const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('生命值不足'), `错误信息应包含"生命值不足"，实际: ${result.error}`);
});

test('3-3: 满足条件可以兑换高级符咒', () => {
  const mediumSpell = createSpellCard(2, '中级符咒', 'spell_002');
  const yokai = createYokaiCard(5, '高级妖怪');
  
  player1.hand = [mediumSpell];
  player1.discard = [yokai];
  player1.exiled = [];
  (player1 as any).hasGainedAdvancedSpell = false;
  
  const yokaiId = yokai.instanceId;
  const result = (game as any).handleExchangeAdvancedSpell('player1', yokaiId);
  
  assertTrue(result.success, `应该成功，实际: ${result.error}`);
  assertEqual(player1.hand.length, 0, '手牌应该被清空');
  assertEqual(player1.exiled.length, 2, '超度区应有2张牌');
  assertEqual(player1.discard.length, 1, '弃牌堆应有1张牌');
  assertEqual(player1.discard[0].name, '高级符咒', '应该是高级符咒');
  assertEqual(player1.discard[0].damage, 3, '伤害应该是3');
});

test('3-4: 本回合已兑换高级符咒不能再次兑换', () => {
  player1.hand = [createSpellCard(2, '中级符咒', 'spell_002')];
  player1.discard = [createYokaiCard(5, '另一个高级妖怪')];
  // hasGainedAdvancedSpell 已经是 true
  
  const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
  
  assertTrue(!result.success, '应该失败');
  assertTrue(result.error?.includes('已兑换'), `错误信息应包含"已兑换"，实际: ${result.error}`);
});

console.log('\n【四、回合重置测试】\n');

test('4-1: 新回合开始时重置获取标记', () => {
  // 设置所有标记为 true
  player1.hasGainedBasicSpell = true;
  (player1 as any).hasGainedMediumSpell = true;
  (player1 as any).hasGainedAdvancedSpell = true;
  
  // 模拟开始新回合（调用 startTurn）
  (game as any).state.currentPlayerIndex = 0;
  (game as any).startTurn();
  
  // 验证标记被重置
  assertEqual(player1.hasGainedBasicSpell, false, 'hasGainedBasicSpell 应被重置');
  assertEqual((player1 as any).hasGainedMediumSpell, false, 'hasGainedMediumSpell 应被重置');
  assertEqual((player1 as any).hasGainedAdvancedSpell, false, 'hasGainedAdvancedSpell 应被重置');
});

console.log('\n【五、超度区验证】\n');

test('5-1: 兑换中级符咒时基础术式和妖怪都进入超度区', () => {
  const basicSpell = createSpellCard(1, '基础术式', 'spell_001');
  const yokai = createYokaiCard(3, '被超度的妖怪');
  
  player1.hand = [basicSpell];
  player1.discard = [yokai];
  player1.exiled = [];
  (player1 as any).hasGainedMediumSpell = false;
  
  (game as any).handleExchangeMediumSpell('player1', yokai.instanceId);
  
  // 验证超度区
  assertEqual(player1.exiled.length, 2, '超度区应有2张牌');
  const hasSpell = player1.exiled.some((c: any) => c.name === '基础术式');
  const hasYokai = player1.exiled.some((c: any) => c.name === '被超度的妖怪');
  assertTrue(hasSpell, '超度区应有基础术式');
  assertTrue(hasYokai, '超度区应有被超度的妖怪');
});

test('5-2: 兑换高级符咒时中级符咒和妖怪都进入超度区', () => {
  const mediumSpell = createSpellCard(2, '中级符咒', 'spell_002');
  const yokai = createYokaiCard(5, '被超度的大妖怪');
  
  player1.hand = [mediumSpell];
  player1.discard = [yokai];
  player1.exiled = [];
  (player1 as any).hasGainedAdvancedSpell = false;
  
  (game as any).handleExchangeAdvancedSpell('player1', yokai.instanceId);
  
  // 验证超度区
  assertEqual(player1.exiled.length, 2, '超度区应有2张牌');
  const hasSpell = player1.exiled.some((c: any) => c.name === '中级符咒');
  const hasYokai = player1.exiled.some((c: any) => c.name === '被超度的大妖怪');
  assertTrue(hasSpell, '超度区应有中级符咒');
  assertTrue(hasYokai, '超度区应有被超度的妖怪');
});

// ============ 测试总结 ============

console.log('\n════════════════════════════════════════════');
console.log('  测试结果汇总');
console.log('════════════════════════════════════════════\n');

const passed = testResults.filter(t => t.passed).length;
const failed = testResults.filter(t => !t.passed).length;

console.log(`  总计: ${testResults.length} 个测试`);
console.log(`  ✅ 通过: ${passed}`);
console.log(`  ❌ 失败: ${failed}`);

if (failed > 0) {
  console.log('\n  失败的测试:');
  testResults.filter(t => !t.passed).forEach(t => {
    console.log(`    - ${t.name}: ${t.error}`);
  });
}

console.log('\n════════════════════════════════════════════\n');

// 导出结果（用于CI）
export { testResults, passed, failed };
