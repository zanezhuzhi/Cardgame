/**
 * 妖怪御魂效果测试 - HP4-5 (骰子鬼~镜姬)
 * 包含: 骰子鬼、涅槃之火、铮、网切、魍魉之匣、狂骨、心眼、针女、破势、镜姬
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  executeYokaiEffect, 
  aiDecide_唐纸伞妖, 
  aiSelect_天邪鬼绿,
  aiDecide_天邪鬼赤,
  aiDecide_天邪鬼黄,
  aiDecide_魅妖
} from '../YokaiEffects';
import { createTestPlayer, createTestGameState, createTestCard, createYokaiCard, createSpellCard, createOpponent } from './testUtils';
import type { CardInstance, PlayerState, GameState } from '../../../types';



describe('骰子鬼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('超度1张手牌，退治HP≤超度牌HP+2的妖怪', async () => {
      // 手牌有一张HP=2的妖怪
      const handCard = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      player.hand = [handCard];
      
      // 场上有HP=4和HP=5的妖怪（只有HP=4的符合退治条件：HP≤2+2=4）
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      const yokai5 = { ...createTestCard('yokai', '狂骨'), hp: 5, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai4;
      gameState.field.yokaiSlots[1] = yokai5;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [handCard.instanceId],
        onSelectTarget: async (targets) => {
          // 只应有HP=4的妖怪可选
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('骰子鬼');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('超度');
      expect(result.message).toContain('退治');
      expect(player.exiled.length).toBe(1); // 手牌被超度
      expect(player.exiled[0]!.name).toBe('赤舌');
      expect(player.discard.length).toBe(1); // 妖怪被退治进入弃牌堆
      expect(player.discard[0]!.name).toBe('骰子鬼');
      expect(gameState.field.yokaiSlots[0]).toBeNull(); // HP=4的妖怪被移除
      expect(gameState.field.yokaiSlots[1]).not.toBeNull(); // HP=5的妖怪仍在
    });

    it('超度招福达摩(HP=1)，可退治HP≤3的妖怪', async () => {
      const daruma = { ...createTestCard('token', '招福达摩'), hp: 1, charm: 1 };
      player.hand = [daruma];
      
      const yokai3 = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai3;
      gameState.field.yokaiSlots[1] = yokai4;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [daruma.instanceId],
        onSelectTarget: async (targets) => {
          // 只有HP=3可选（HP≤1+2=3）
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('灯笼鬼');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(player.exiled[0]!.name).toBe('招福达摩');
      expect(player.discard[0]!.name).toBe('灯笼鬼');
    });
  });

  describe('🔴 边界条件', () => {
    it('手牌为空时返回失败', async () => {
      player.hand = [];

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有手牌可超度');
    });

    it('场上没有符合条件的妖怪时，仅执行超度', async () => {
      const handCard = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      player.hand = [handCard];
      
      // 场上所有妖怪HP都>4（超度HP=2后，可退治范围为HP≤4）
      const yokai5 = { ...createTestCard('yokai', '狂骨'), hp: 5, charm: 1 };
      const yokai6 = { ...createTestCard('yokai', '破势'), hp: 6, charm: 2 };
      gameState.field.yokaiSlots[0] = yokai5;
      gameState.field.yokaiSlots[1] = yokai6;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [handCard.instanceId]
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有可退治的妖怪');
      expect(player.exiled.length).toBe(1); // 手牌仍被超度
      expect(player.discard.length).toBe(0); // 无妖怪被退治
    });

    it('超度无HP属性的牌(阴阳术)，默认按HP=0计算，可退治HP≤2', async () => {
      // 阴阳术没有hp属性，测试时需要确保hp为undefined或0
      const spell = createTestCard('spell', '基础术式');
      delete (spell as any).hp; // 确保无HP属性
      player.hand = [spell];
      
      const yokai2 = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const yokai3 = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai2;
      gameState.field.yokaiSlots[1] = yokai3;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [spell.instanceId],
        onSelectTarget: async (targets) => {
          // 只有HP=2可选（HP≤0+2=2）
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('赤舌');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(player.exiled[0]!.name).toBe('基础术式');
      expect(player.discard[0]!.name).toBe('赤舌');
    });
  });

  describe('🤖 AI接管（无回调）', () => {
    it('AI超度声誉最低的牌', async () => {
      // 两张手牌：声誉0和声誉1
      const lowCharm = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highCharm = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      player.hand = [highCharm, lowCharm]; // 高声誉在前
      
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai4;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择声誉=0的赤舌超度
      expect(player.exiled[0]!.name).toBe('赤舌');
    });

    it('AI同声誉时超度HP最高的牌（扩大退治范围）', async () => {
      // 两张手牌：同声誉，不同HP
      const lowHp = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highHp = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 0 };
      player.hand = [lowHp, highHp];
      
      const yokai6 = { ...createTestCard('yokai', '破势'), hp: 6, charm: 2 };
      gameState.field.yokaiSlots[0] = yokai6;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择HP=4的牌超度（可退治HP≤6）
      expect(player.exiled[0]!.name).toBe('骰子鬼');
      // 并且能退治HP=6的妖怪
      expect(player.discard[0]!.name).toBe('破势');
    });

    it('AI退治声誉最高的妖怪', async () => {
      const handCard = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      player.hand = [handCard];
      
      // 两个符合条件的妖怪：声誉不同
      const lowCharmYokai = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highCharmYokai = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      gameState.field.yokaiSlots[0] = lowCharmYokai;
      gameState.field.yokaiSlots[1] = highCharmYokai;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择声誉=1的灯笼鬼退治
      expect(player.discard[0]!.name).toBe('灯笼鬼');
    });
  });

  describe('🤖 AI决策函数', () => {
    it('aiDecide_骰子鬼_超度：返回声誉最低的牌', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('../YokaiEffects');
      
      const cards = [
        { ...createTestCard('yokai'), charm: 1, hp: 2 },
        { ...createTestCard('yokai'), charm: 0, hp: 3 },
      ];
      
      const result = aiDecide_骰子鬼_超度(cards);
      expect(result).toBe(cards[1]!.instanceId); // 声誉=0的牌
    });

    it('aiDecide_骰子鬼_超度：同声誉时返回HP最高的牌', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('../YokaiEffects');
      
      const cards = [
        { ...createTestCard('yokai'), charm: 0, hp: 2 },
        { ...createTestCard('yokai'), charm: 0, hp: 4 },
      ];
      
      const result = aiDecide_骰子鬼_超度(cards);
      expect(result).toBe(cards[1]!.instanceId); // HP=4的牌
    });

    it('aiDecide_骰子鬼_退治：返回声誉最高的妖怪', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('../YokaiEffects');
      
      const targets = [
        { ...createTestCard('yokai'), charm: 1, hp: 3 },
        { ...createTestCard('yokai'), charm: 2, hp: 2 },
      ];
      
      const result = aiDecide_骰子鬼_退治(targets);
      expect(result).toBe(targets[1]!.instanceId); // 声誉=2的妖怪
    });

    it('aiDecide_骰子鬼_退治：同声誉时返回HP最高的妖怪', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('../YokaiEffects');
      
      const targets = [
        { ...createTestCard('yokai'), charm: 1, hp: 2 },
        { ...createTestCard('yokai'), charm: 1, hp: 4 },
      ];
      
      const result = aiDecide_骰子鬼_退治(targets);
      expect(result).toBe(targets[1]!.instanceId); // HP=4的妖怪
    });

    it('aiDecide_骰子鬼_超度：空手牌返回空字符串', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('../YokaiEffects');
      expect(aiDecide_骰子鬼_超度([])).toBe('');
    });

    it('aiDecide_骰子鬼_退治：空目标返回空字符串', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('../YokaiEffects');
      expect(aiDecide_骰子鬼_退治([])).toBe('');
    });
  });

  describe('🔴 边界测试：多次使用骰子鬼', () => {
    it('超度2次退治2只妖怪', async () => {
      // 准备3张手牌
      player.hand = [
        { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 1 },
        { ...createTestCard('spell', '基础术式'), hp: 0, charm: 0 },
        { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 0 }
      ];
      
      // 场上放2只HP=2和HP=4的妖怪
      const yokai2 = { ...createTestCard('yokai', '天邪鬼青'), hp: 2, charm: 0, instanceId: 'y-2' };
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1, instanceId: 'y-4' };
      gameState.field.yokaiSlots = [yokai2, yokai4, null, null, null, null];
      
      // 第一次：超度HP=2的赤舌，可退治HP≤4的妖怪
      const result1 = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async (cards) => {
          const card = cards.find(c => c.name === '赤舌');
          return card ? [card.instanceId] : [];
        },
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result1.success).toBe(true);
      expect(player.exiled.length).toBe(1);
      expect(player.exiled[0]!.name).toBe('赤舌');
      expect(player.hand.length).toBe(2);
      
      // 场上应只剩1只妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(1);
      
      // 第二次：超度HP=3的灯笼鬼，可退治HP≤5的妖怪
      const result2 = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async (cards) => {
          const card = cards.find(c => c.name === '灯笼鬼');
          return card ? [card.instanceId] : [];
        },
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result2.success).toBe(true);
      expect(player.exiled.length).toBe(2);
      expect(player.hand.length).toBe(1); // 只剩基础术式
      
      // 场上应无妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(0);
    });
    
    it('超度高HP牌可以退治更强的妖怪', async () => {
      // 准备1张HP=5的妖怪
      const highHpCard = { ...createTestCard('yokai', '心眼'), hp: 5, charm: 0 };
      player.hand = [highHpCard];
      
      // 场上放HP=7的妖怪（需要超度HP≥5的牌才能退治）
      const yokai7 = { ...createTestCard('yokai', '幽谷响'), hp: 7, charm: 1, instanceId: 'y-7' };
      gameState.field.yokaiSlots = [yokai7, null, null, null, null, null];
      
      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result.success).toBe(true);
      expect(player.exiled.length).toBe(1);
      expect(player.exiled[0]!.name).toBe('心眼');
      // HP=5的牌可以退治HP≤7的妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(0);
    });
  });
});
describe('涅槃之火', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('添加技能消耗减少buff', async () => {
    const result = await executeYokaiEffect('涅槃之火', {
      player, gameState, card: createTestCard('yokai', '涅槃之火')
    });

    expect(result.success).toBe(true);
    const buff = player.tempBuffs.find(b => (b as any).source === '涅槃之火');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(1);
  });
});

describe('铮', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('主动效果', () => {
    it('🟢 抓牌+1，伤害+2', async () => {
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(2);
    });

    it('🔴 牌库为空时仍增加伤害+2，抓牌为0', async () => {
      player.deck = [];
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2);
      expect(player.hand.length).toBe(0);
    });

    it('🔴 牌库为空但弃牌堆有牌时，洗入后抓牌', async () => {
      player.deck = [];
      player.discard = [createTestCard('yokai', '招福达摩')];
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2);
      expect(player.hand.length).toBe(1); // 弃牌堆洗入后抓到1张
      expect(player.discard.length).toBe(0);
    });

    it('🟢 已有伤害时累加', async () => {
      player.damage = 3;
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(5); // 3 + 2
    });
  });

  describe('轮入道兼容', () => {
    it('🟢 轮入道+铮：效果执行2次，抓牌+2，伤害+4', async () => {
      player.deck = [
        createTestCard('spell', '术式1'),
        createTestCard('spell', '术式2'),
      ];
      const zhengCard = createTestCard('yokai', '铮');

      // 模拟轮入道执行两次铮的效果
      const ctx = { player, gameState, card: zhengCard };
      await executeYokaiEffect('铮', ctx);
      await executeYokaiEffect('铮', ctx);

      expect(player.damage).toBe(4); // 2 + 2
      expect(player.hand.length).toBe(2); // 抓1 + 抓1
    });

    it('🔴 轮入道+铮：第一次抓牌耗尽牌库，第二次无牌可抓', async () => {
      player.deck = [createTestCard('spell', '术式1')];
      const zhengCard = createTestCard('yokai', '铮');

      const ctx = { player, gameState, card: zhengCard };
      await executeYokaiEffect('铮', ctx);
      await executeYokaiEffect('铮', ctx);

      expect(player.damage).toBe(4); // 2 + 2
      expect(player.hand.length).toBe(1); // 只抓到1张
    });
  });
});

describe('网切', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('🟢 基础效果：在field.tempBuffs添加NET_CUTTER_HP_REDUCTION', async () => {
    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    expect(gameState.field.tempBuffs).toBeDefined();
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff).toBeDefined();
    expect(buff.yokaiHpModifier).toBe(-1);
    expect(buff.bossHpModifier).toBe(-2);
    expect(buff.minHp).toBe(1);
    expect(buff.expiresAt).toBe('endOfTurn');
    expect(buff.sourcePlayerId).toBe(player.id);
  });

  it('🟢 妖怪HP-1：场上游荡妖怪受影响', async () => {
    // 场上放置妖怪
    const yokai5 = { ...createTestCard('yokai', '心眼'), hp: 5, maxHp: 5 };
    const yokai3 = { ...createTestCard('yokai', '天邪鬼青'), hp: 3, maxHp: 3 };
    gameState.field.yokaiSlots = [yokai5, yokai3, null, null, null, null];

    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    // 验证buff已设置
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff).toBeDefined();
    // 注意：网切设置的是HP修正状态，实际HP计算由EffectiveHP系统或服务端处理
    // 这里验证状态标记正确即可
    expect(buff.yokaiHpModifier).toBe(-1);
  });

  it('🟢 鬼王HP-2：鬼王受影响', async () => {
    gameState.field.currentBoss = { ...createTestCard('boss', '麒麟'), hp: 8, maxHp: 8 };
    gameState.field.bossCurrentHp = 8;

    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff.bossHpModifier).toBe(-2);
  });

  it('🟢 HP最低值保护标记', async () => {
    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff.minHp).toBe(1);
  });

  it('🟢 多次使用不叠加（覆盖）', async () => {
    // 第一次使用
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });
    expect((gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    ).length).toBe(1);

    // 第二次使用（应覆盖而非叠加）
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });
    const netCutterBuffs = (gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(netCutterBuffs.length).toBe(1);  // 仍然只有1个buff
    expect(netCutterBuffs[0].yokaiHpModifier).toBe(-1);  // 不是-2
    expect(netCutterBuffs[0].bossHpModifier).toBe(-2);   // 不是-4
  });

  it('🟢 回合结束可清除（endOfTurn标记）', async () => {
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    // 模拟回合结束清理
    gameState.field.tempBuffs = (gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.expiresAt !== 'endOfTurn'
    );

    expect(gameState.field.tempBuffs.length).toBe(0);
  });
});

describe('魍魉之匣', () => {
  let player: PlayerState;
  let opponent1: PlayerState;
  let opponent2: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ name: '玩家A' });
    player.deck = [createTestCard('spell', '基础术式')];
    
    opponent1 = createTestPlayer({ name: '玩家B' });
    opponent1.id = 'opponent1';
    opponent1.deck = [createTestCard('yokai', '赤舌')];
    
    opponent2 = createTestPlayer({ name: '玩家C' });
    opponent2.id = 'opponent2';
    opponent2.deck = [createTestCard('yokai', '灯笼鬼')];
    
    gameState = createTestGameState(player);
    gameState.players = [player, opponent1, opponent2];
  });

  it('🟢 基础效果：抓牌+1，伤害+1', async () => {
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 0 // 全部保留
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(1); // 抓1张
    expect(player.damage).toBe(1);      // 伤害+1
  });

  it('🟢 选择保留：所有玩家牌库顶不变', async () => {
    const originalDeckLengths = [player.deck.length, opponent1.deck.length, opponent2.deck.length];
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 0 // 全部选择保留
    });

    expect(result.success).toBe(true);
    // 玩家自己的牌库因抓牌减少1张
    expect(player.deck.length).toBe(originalDeckLengths[0] - 1);
    // 对手牌库不变（保留）
    expect(opponent1.deck.length).toBe(originalDeckLengths[1]);
    expect(opponent2.deck.length).toBe(originalDeckLengths[2]);
    // 对手弃牌堆不变
    expect(opponent1.discard.length).toBe(0);
    expect(opponent2.discard.length).toBe(0);
  });

  it('🟢 选择弃置：对手牌库顶移入弃牌堆', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示弃置
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 1 // 全部选择弃置
    });

    expect(result.success).toBe(true);
    // 玩家自己的牌库顶也被弃置（drawCards抓1张+弃置1张=deck从2变0）
    expect(player.deck.length).toBe(0);
    expect(player.discard.length).toBe(1);
    // 对手牌库顶被弃置
    expect(opponent1.deck.length).toBe(0);
    expect(opponent1.discard.length).toBe(1);
    expect(opponent1.discard[0]!.name).toBe('赤舌');
    expect(opponent2.deck.length).toBe(0);
    expect(opponent2.discard.length).toBe(1);
    expect(opponent2.discard[0]!.name).toBe('灯笼鬼');
  });

  it('🟢 混合选择：保留自己、弃置对手', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    
    let choiceIndex = 0;
    const choices = [0, 1, 1]; // 保留玩家A、弃置玩家B、弃置玩家C
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => choices[choiceIndex++]!
    });

    expect(result.success).toBe(true);
    // 玩家自己保留（牌库顶不弃置，deck剩1张）
    expect(player.deck.length).toBe(1);
    expect(player.discard.length).toBe(0);
    // 对手被弃置
    expect(opponent1.discard.length).toBe(1);
    expect(opponent2.discard.length).toBe(1);
  });

  it('🔴 边界条件：空牌库跳过', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    opponent1.deck = []; // 对手1牌库为空
    
    let choiceCount = 0;
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => { choiceCount++; return 0; }
    });

    expect(result.success).toBe(true);
    // 触发2次选择（玩家A + 玩家C），跳过空牌库的玩家B
    expect(choiceCount).toBe(2);
  });

  it('🔴 超时默认：默认保留（index=0）', async () => {
    // 不传 onChoice，模拟超时走默认
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣')
    });

    expect(result.success).toBe(true);
    // 默认保留，对手牌库不变
    expect(opponent1.deck.length).toBe(1);
    expect(opponent2.deck.length).toBe(1);
    expect(opponent1.discard.length).toBe(0);
    expect(opponent2.discard.length).toBe(0);
  });
});

// ============================================
// 生命5 妖怪测试
// ============================================
describe('狂骨', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 4 });
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('基础效果', () => {
    it('🟢 鬼火=4时，抓牌+1，伤害+4', async () => {
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(4); // 等于鬼火数
    });

    it('🟢 鬼火=5时，伤害+5（最大收益）', async () => {
      player.ghostFire = 5;
      player.damage = 2; // 已有伤害
      player.deck = [createTestCard('spell'), createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(7); // 2+5=7
      expect(player.hand.length).toBe(1);
    });
  });

  describe('边界条件', () => {
    it('🔴 鬼火=0时，伤害+0（仍可打出）', async () => {
      player.ghostFire = 0;
      player.damage = 0;
      player.deck = [createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(0); // +0
      expect(player.hand.length).toBe(1); // 仍抓牌
    });

    it('🔴 牌库为空时仍增加伤害', async () => {
      player.ghostFire = 4;
      player.damage = 0;
      player.deck = []; // 空牌库
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(4); // +4
      expect(player.hand.length).toBe(0); // 无牌可抓
    });

    it('🟢 轮入道双重效果：两次执行，伤害累加', async () => {
      player.ghostFire = 3;
      player.damage = 0;
      player.deck = [createTestCard('spell'), createTestCard('spell'), createTestCard('spell')];
      
      // 第一次执行
      await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });
      expect(player.damage).toBe(3);
      expect(player.hand.length).toBe(1);
      
      // 第二次执行（轮入道触发）
      await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });
      
      expect(player.damage).toBe(6); // 3+3=6
      expect(player.hand.length).toBe(2); // 1+1=2
    });

    it('🔴 鬼火=1时，伤害+1（低收益）', async () => {
      player.ghostFire = 1;
      player.damage = 0;
      player.deck = [createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
    });

    it('🔴 手牌已满10张时跳过抓牌，仍按打出瞬间鬼火加伤', async () => {
      player.ghostFire = 4;
      player.damage = 0;
      player.deck = [createTestCard('spell'), createTestCard('spell')];
      while (player.hand.length < 10) {
        player.hand.push(createTestCard('spell'));
      }

      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(10);
      expect(player.damage).toBe(4);
    });
  });
});

describe('心眼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('伤害+3', async () => {
    const result = await executeYokaiEffect('心眼', {
      player, gameState, card: createTestCard('yokai', '心眼')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(3);
  });
});

describe('针女', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('伤害+1并添加技能伤害buff', async () => {
    const result = await executeYokaiEffect('针女', {
      player, gameState, card: createTestCard('yokai', '针女')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(1);
    const buff = player.tempBuffs.find(b => (b as any).source === '针女');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(2);
  });
});

// ============================================
// 生命6 妖怪测试
// ============================================
describe('破势', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('首张牌伤害+5', async () => {
    (player as any).cardsPlayed = 1;
    (player as any).played = [createTestCard('yokai', '破势')];

    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(5);
  });

  it('非首张牌伤害+3', async () => {
    (player as any).cardsPlayed = 3;
    (player as any).played = [
      createTestCard('spell', '基础术式'),
      createTestCard('spell', '中级符咒'),
      createTestCard('yokai', '破势')
    ];

    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(3);
  });

  it('无cardsPlayed字段时默认为首张（兼容）', async () => {
    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(5);
  });
});

describe('镜姬', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('抓牌+2，伤害+1，鬼火+1', async () => {
    const result = await executeYokaiEffect('镜姬', {
      player, gameState, card: createTestCard('yokai', '镜姬')
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(2);
    expect(player.damage).toBe(1);
    expect(player.ghostFire).toBe(3);
  });
});

// ============================================
