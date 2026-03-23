/**
 * 式神获取/置换 - 自动化测试
 * TDD Red/Green 测试
 */

import { MultiplayerGame } from './MultiplayerGame';

// 模拟玩家信息
const mockPlayers = [
  { id: 'player1', name: '测试玩家1' },
  { id: 'player2', name: '测试玩家2' },
];

// 创建测试用的卡牌
function createSpellCard(damage: number, name: string) {
  return {
    instanceId: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId: `spell_00${damage}`,
    cardType: 'spell' as const,
    name,
    damage,
    hp: damage,
    charm: 0,
    effect: '',
    image: '',
  };
}

function createShikigamiCard(id: string, name: string) {
  return {
    id,
    name,
    skill: '测试技能',
    exhaustCondition: '无',
    exhaustEffect: '无',
    charm: 2,
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
console.log('  式神获取/置换 - TDD 测试');
console.log('════════════════════════════════════════════\n');

// 创建游戏实例（传入玩家数组）
const game = new MultiplayerGame('test-room', mockPlayers as any);

// 跳过式神选择阶段，直接开始游戏
(game as any).state.phase = 'playing';
(game as any).state.turnPhase = 'action';
(game as any).state.currentPlayerIndex = 0;

// 获取玩家引用
const player1 = (game as any).state.players[0];

console.log('【一、按钮状态测试】\n');

test('1-1: 无式神，符咒伤害<5 → 不能获取式神', () => {
  // 清空手牌，添加2张初级符咒（伤害=1）
  player1.hand = [];
  player1.shikigami = [];
  player1.hand.push(createSpellCard(1, '初级符咒'));
  player1.hand.push(createSpellCard(1, '初级符咒'));
  
  // 尝试获取式神候选（应该失败）
  const result = (game as any).handleGetShikigamiCandidates(
    'player1',
    player1.hand.map((c: any) => c.instanceId),
    false
  );
  
  assertTrue(!result.success, '应该返回失败');
  assertTrue(result.error?.includes('伤害不足'), `错误信息应包含"伤害不足"，实际: ${result.error}`);
});

test('1-2: 无式神，符咒伤害>=5，无高级符咒 → 不能获取式神', () => {
  // 添加5张初级符咒（伤害=5，但没有高级符咒）
  player1.hand = [];
  player1.shikigami = [];
  for (let i = 0; i < 5; i++) {
    player1.hand.push(createSpellCard(1, '初级符咒'));
  }
  
  const result = (game as any).handleGetShikigamiCandidates(
    'player1',
    player1.hand.map((c: any) => c.instanceId),
    false
  );
  
  assertTrue(!result.success, '应该返回失败');
  assertTrue(result.error?.includes('高级符咒'), `错误信息应包含"高级符咒"，实际: ${result.error}`);
});

test('1-3: 无式神，符咒伤害>=5，有高级符咒 → 可以获取式神', () => {
  // 添加1张高级符咒 + 2张中级符咒（伤害=3+2+2=7）
  player1.hand = [];
  player1.shikigami = [];
  player1.hand.push(createSpellCard(3, '高级符咒'));
  player1.hand.push(createSpellCard(2, '中级符咒'));
  player1.hand.push(createSpellCard(2, '中级符咒'));
  
  // 确保式神牌堆有牌
  (game as any).state.field.shikigamiSupply = [
    createShikigamiCard('s1', '测试式神1'),
    createShikigamiCard('s2', '测试式神2'),
    createShikigamiCard('s3', '测试式神3'),
  ];
  
  const result = (game as any).handleGetShikigamiCandidates(
    'player1',
    player1.hand.map((c: any) => c.instanceId),
    false
  );
  
  assertTrue(result.success, `应该返回成功，实际: ${result.error}`);
});

test('1-4: 3个式神，无高级符咒 → 不能置换式神', () => {
  player1.hand = [];
  player1.shikigami = [
    createShikigamiCard('s1', '式神1'),
    createShikigamiCard('s2', '式神2'),
    createShikigamiCard('s3', '式神3'),
  ];
  player1.hand.push(createSpellCard(1, '初级符咒'));
  
  const result = (game as any).handleGetShikigamiCandidates(
    'player1',
    player1.hand.map((c: any) => c.instanceId),
    true // isReplace = true
  );
  
  assertTrue(!result.success, '应该返回失败');
  assertTrue(result.error?.includes('高级符咒'), `错误信息应包含"高级符咒"，实际: ${result.error}`);
});

test('1-5: 3个式神，有高级符咒 → 可以置换式神', () => {
  player1.hand = [];
  player1.shikigami = [
    createShikigamiCard('s1', '式神1'),
    createShikigamiCard('s2', '式神2'),
    createShikigamiCard('s3', '式神3'),
  ];
  player1.hand.push(createSpellCard(3, '高级符咒'));
  
  // 确保式神牌堆有牌
  (game as any).state.field.shikigamiSupply = [
    createShikigamiCard('s4', '新式神1'),
    createShikigamiCard('s5', '新式神2'),
  ];
  
  const result = (game as any).handleGetShikigamiCandidates(
    'player1',
    player1.hand.map((c: any) => c.instanceId),
    true // isReplace = true
  );
  
  assertTrue(result.success, `应该返回成功，实际: ${result.error}`);
});

console.log('\n【二、获得式神流程测试】\n');

test('2-1: 选择符咒后，符咒移入超度区', () => {
  // 重置
  player1.hand = [];
  player1.exiled = [];
  player1.shikigami = [];
  
  const spell1 = createSpellCard(3, '高级符咒');
  const spell2 = createSpellCard(2, '中级符咒');
  player1.hand.push(spell1);
  player1.hand.push(spell2);
  
  (game as any).state.field.shikigamiSupply = [
    createShikigamiCard('s1', '测试式神1'),
    createShikigamiCard('s2', '测试式神2'),
  ];
  
  const spellIds = player1.hand.map((c: any) => c.instanceId);
  (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
  
  // 验证符咒被移到超度区
  assertEqual(player1.hand.length, 0, '手牌应为空');
  assertEqual(player1.exiled.length, 2, '超度区应有2张牌');
});

test('2-2: 候选数量固定为2个', () => {
  player1.hand = [];
  player1.exiled = [];
  player1.shikigami = [];
  
  player1.hand.push(createSpellCard(3, '高级符咒'));
  player1.hand.push(createSpellCard(3, '高级符咒'));
  player1.hand.push(createSpellCard(3, '高级符咒')); // 总伤害=9
  
  (game as any).state.field.shikigamiSupply = [
    createShikigamiCard('s1', '测试式神1'),
    createShikigamiCard('s2', '测试式神2'),
    createShikigamiCard('s3', '测试式神3'),
    createShikigamiCard('s4', '测试式神4'),
  ];
  
  const spellIds = player1.hand.map((c: any) => c.instanceId);
  (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
  
  // 验证候选数量
  const candidates = (player1 as any).pendingShikigamiCandidates;
  assertEqual(candidates.length, 2, '候选应该固定为2个');
});

test('2-3: 确认获取式神后，式神加入玩家区域', () => {
  player1.hand = [];
  player1.exiled = [];
  player1.shikigami = [];
  player1.shikigamiState = [];
  
  player1.hand.push(createSpellCard(3, '高级符咒'));
  player1.hand.push(createSpellCard(2, '中级符咒'));
  
  const testShikigami1 = createShikigamiCard('acquire_test_1', '获取测试式神1');
  const testShikigami2 = createShikigamiCard('acquire_test_2', '获取测试式神2');
  (game as any).state.field.shikigamiSupply = [testShikigami1, testShikigami2];
  
  const spellIds = player1.hand.map((c: any) => c.instanceId);
  (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
  
  // 选择第一个式神
  const result = (game as any).handleAcquireShikigami('player1', 'acquire_test_2', []);
  
  assertTrue(result.success, `应该成功获取式神，实际: ${result.error}`);
  assertEqual(player1.shikigami.length, 1, '应该有1个式神');
  assertEqual(player1.shikigami[0].name, '获取测试式神2', '式神名称应正确');
});

test('2-4: 未选中的式神放回牌堆', () => {
  // 检查牌堆中是否有未选中的式神
  const supply = (game as any).state.field.shikigamiSupply;
  const hasUnselected = supply.some((s: any) => s.id === 'acquire_test_1');
  assertTrue(hasUnselected, '未选中的式神应放回牌堆');
});

test('2-5: 式神上限为3个', () => {
  player1.shikigami = [
    createShikigamiCard('s1', '式神1'),
    createShikigamiCard('s2', '式神2'),
    createShikigamiCard('s3', '式神3'),
  ];
  
  (player1 as any).pendingShikigamiCandidates = [createShikigamiCard('s4', '新式神')];
  
  const result = (game as any).handleAcquireShikigami('player1', 's4', []);
  
  assertTrue(!result.success, '应该返回失败');
  assertTrue(result.error?.includes('上限'), `错误信息应包含"上限"，实际: ${result.error}`);
});

console.log('\n【三、置换式神流程测试】\n');

test('3-1: 置换式神需要恰好1张高级符咒', () => {
  player1.hand = [];
  player1.shikigami = [
    createShikigamiCard('old1', '旧式神1'),
    createShikigamiCard('old2', '旧式神2'),
    createShikigamiCard('old3', '旧式神3'),
  ];
  
  // 添加2张高级符咒（应该失败）
  player1.hand.push(createSpellCard(3, '高级符咒'));
  player1.hand.push(createSpellCard(3, '高级符咒'));
  
  const spellIds = player1.hand.map((c: any) => c.instanceId);
  const result = (game as any).handleGetShikigamiCandidates('player1', spellIds, true);
  
  assertTrue(!result.success, '2张高级符咒应该失败');
  assertTrue(result.error?.includes('恰好1张'), `错误信息应包含"恰好1张"，实际: ${result.error}`);
});

test('3-2: 置换后旧式神放回牌堆', () => {
  player1.hand = [];
  player1.exiled = [];
  player1.shikigami = [
    createShikigamiCard('replace_old', '被替换的式神'),
  ];
  player1.shikigamiState = [{ cardId: 'replace_old', isExhausted: false, markers: {} }];
  
  player1.hand.push(createSpellCard(3, '高级符咒'));
  
  const newShikigami = createShikigamiCard('replace_new', '新式神');
  (game as any).state.field.shikigamiSupply = [newShikigami, createShikigamiCard('other', '其他')];
  
  const spellIds = player1.hand.map((c: any) => c.instanceId);
  (game as any).handleGetShikigamiCandidates('player1', spellIds, true);
  
  // 执行置换
  const result = (game as any).handleReplaceShikigami('player1', 'replace_new', 0, []);
  
  assertTrue(result.success, `应该成功置换，实际: ${result.error}`);
  assertEqual(player1.shikigami[0].name, '新式神', '新式神应该在槽位0');
  
  // 检查旧式神是否放回牌堆
  const supply = (game as any).state.field.shikigamiSupply;
  const hasOld = supply.some((s: any) => s.id === 'replace_old');
  assertTrue(hasOld, '旧式神应放回牌堆');
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
