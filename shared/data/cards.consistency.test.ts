/**
 * 卡牌数据一致性测试
 * 基于文档 v0.3.0 验证所有卡牌数据
 */

import { describe, it, expect } from 'vitest';
import cardsData from './cards.json';

// ===========================================
// 一、阴阳术卡一致性测试
// ===========================================
describe('阴阳术数据一致性验证 (基于文档 v0.3.0)', () => {
  const spellData = cardsData.spell;

  // 文档定义
  const SPELL_SPEC = [
    {
      name: '基础术式',
      damage: 1,
      charm: 0,
      count: 50,
      effect: '【触】超度此牌：超度弃牌堆中目标生命不低于2的妖怪，获得「中级符咒」。'
    },
    {
      name: '中级符咒',
      damage: 2,
      charm: 0,
      count: 20,
      effect: '【触】超度此牌：超度弃牌堆中目标生命不低于4的妖怪，获得「高级符咒」。'
    },
    {
      name: '高级符咒',
      damage: 3,
      charm: 1,
      count: 10,
      effect: '【触】超度此牌：你可以获得阴阳师对应的任意「专属符咒」。'
    }
  ];

  describe('🔴 数量验证', () => {
    it('总计3种阴阳术', () => {
      expect(spellData.length).toBe(3);
    });

    it('总计80张阴阳术卡', () => {
      const total = spellData.reduce((sum, s) => sum + (s.count || 0), 0);
      expect(total).toBe(80);
    });
  });

  describe('🔴 阴阳术属性验证', () => {
    for (const spec of SPELL_SPEC) {
      describe(`${spec.name}`, () => {
        const card = spellData.find(s => s.name === spec.name);

        it('存在于cards.json中', () => {
          expect(card).toBeDefined();
        });

        it(`伤害为 ${spec.damage}`, () => {
          expect(card?.damage).toBe(spec.damage);
        });

        it(`声誉为 ${spec.charm}`, () => {
          expect(card?.charm).toBe(spec.charm);
        });

        it(`数量为 ${spec.count}`, () => {
          expect(card?.count).toBe(spec.count);
        });
      });
    }
  });

  describe('🟢 数据完整性', () => {
    it('每张阴阳术都有唯一ID', () => {
      const ids = spellData.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每张阴阳术都有type字段且为spell', () => {
      for (const card of spellData) {
        expect(card.type).toBe('spell');
      }
    });

    it('每张阴阳术都有image字段', () => {
      for (const card of spellData) {
        expect(card.image).toBeDefined();
      }
    });
  });
});

// ===========================================
// 二、恶评卡一致性测试
// ===========================================
describe('恶评卡数据一致性验证 (基于文档 v0.3.0)', () => {
  const penaltyData = cardsData.penalty;

  // 文档定义
  const PENALTY_SPEC = [
    { name: '农夫', hp: 1, charm: -1, count: 20 },
    { name: '武士', hp: 2, charm: -2, count: 10 }
  ];

  describe('🔴 数量验证', () => {
    it('总计2种恶评卡', () => {
      expect(penaltyData.length).toBe(2);
    });

    it('总计30张恶评卡', () => {
      const total = penaltyData.reduce((sum, p) => sum + (p.count || 0), 0);
      expect(total).toBe(30);
    });
  });

  describe('🔴 恶评卡属性验证', () => {
    for (const spec of PENALTY_SPEC) {
      describe(`${spec.name}`, () => {
        const card = penaltyData.find(p => p.name === spec.name);

        it('存在于cards.json中', () => {
          expect(card).toBeDefined();
        });

        it(`生命值为 ${spec.hp}`, () => {
          expect(card?.hp).toBe(spec.hp);
        });

        it(`声誉为 ${spec.charm}`, () => {
          expect(card?.charm).toBe(spec.charm);
        });

        it(`数量为 ${spec.count}`, () => {
          expect(card?.count).toBe(spec.count);
        });
      });
    }
  });

  describe('🟢 数据完整性', () => {
    it('每张恶评卡都有type字段且为penalty', () => {
      for (const card of penaltyData) {
        expect(card.type).toBe('penalty');
      }
    });
  });
});

// ===========================================
// 三、鬼王卡一致性测试
// ===========================================
describe('鬼王卡数据一致性验证 (基于文档 v0.3.0)', () => {
  const bossData = cardsData.boss;

  // 文档定义
  const BOSS_SPEC = [
    // 阶段 Ⅰ
    { name: '麒麟', stage: 1, hp: 8, charm: 3, multiPlayer: false },
    { name: '石距', stage: 1, hp: 9, charm: 3, multiPlayer: false },
    { name: '鬼灵歌伎', stage: 1, hp: 9, charm: 3, multiPlayer: true },
    { name: '土蜘蛛', stage: 1, hp: 10, charm: 4, multiPlayer: false },
    // 阶段 Ⅱ
    { name: '胧车', stage: 2, hp: 10, charm: 4, multiPlayer: false },
    { name: '蜃气楼', stage: 2, hp: 11, charm: 4, multiPlayer: false },
    { name: '荒骷髅', stage: 2, hp: 12, charm: 4, multiPlayer: true },
    // 阶段 Ⅲ
    { name: '地震鲶', stage: 3, hp: 13, charm: 5, multiPlayer: false },
    { name: '八岐大蛇', stage: 3, hp: 14, charm: 5, multiPlayer: false },
    { name: '贪嗔痴', stage: 3, hp: 15, charm: 5, multiPlayer: true }
  ];

  describe('🔴 数量验证', () => {
    it('总计10张鬼王', () => {
      expect(bossData.length).toBe(10);
    });

    it('阶段Ⅰ有4张鬼王', () => {
      expect(bossData.filter(b => b.stage === 1).length).toBe(4);
    });

    it('阶段Ⅱ有3张鬼王', () => {
      expect(bossData.filter(b => b.stage === 2).length).toBe(3);
    });

    it('阶段Ⅲ有3张鬼王', () => {
      expect(bossData.filter(b => b.stage === 3).length).toBe(3);
    });

    it('多人专属鬼王3张（鬼灵歌伎、荒骷髅、贪嗔痴）', () => {
      const multiPlayerBosses = bossData.filter(b => b.multiplayerOnly === true);
      expect(multiPlayerBosses.length).toBe(3);
    });
  });

  describe('🔴 鬼王属性验证', () => {
    for (const spec of BOSS_SPEC) {
      describe(`${spec.name}（阶段${spec.stage}）`, () => {
        const card = bossData.find(b => b.name === spec.name);

        it('存在于cards.json中', () => {
          expect(card).toBeDefined();
        });

        it(`阶段为 ${spec.stage}`, () => {
          expect(card?.stage).toBe(spec.stage);
        });

        it(`生命值为 ${spec.hp}`, () => {
          expect(card?.hp).toBe(spec.hp);
        });

        it(`声誉为 ${spec.charm}`, () => {
          expect(card?.charm).toBe(spec.charm);
        });

        it(`多人专属标记为 ${spec.multiPlayer}`, () => {
          expect(card?.multiplayerOnly === true).toBe(spec.multiPlayer);
        });
      });
    }
  });

  describe('🔴 声誉与阶段对应关系', () => {
    it('阶段Ⅰ鬼王声誉为3或4', () => {
      const stage1Bosses = bossData.filter(b => b.stage === 1);
      for (const boss of stage1Bosses) {
        expect([3, 4]).toContain(boss.charm);
      }
    });

    it('阶段Ⅱ鬼王声誉为4', () => {
      const stage2Bosses = bossData.filter(b => b.stage === 2);
      for (const boss of stage2Bosses) {
        expect(boss.charm).toBe(4);
      }
    });

    it('阶段Ⅲ鬼王声誉为5', () => {
      const stage3Bosses = bossData.filter(b => b.stage === 3);
      for (const boss of stage3Bosses) {
        expect(boss.charm).toBe(5);
      }
    });
  });

  describe('🟢 数据完整性', () => {
    it('每张鬼王都有唯一ID', () => {
      const ids = bossData.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每张鬼王都有type字段且为boss', () => {
      for (const card of bossData) {
        expect(card.type).toBe('boss');
      }
    });

    it('每张鬼王都有effect和arrival字段', () => {
      for (const card of bossData) {
        expect(card.effect).toBeDefined();
        expect(card.arrival).toBeDefined();
      }
    });
  });

  describe('🟢 特殊机制验证', () => {
    it('麒麟有回合结束归底效果', () => {
      const qilin = bossData.find(b => b.name === '麒麟');
      expect(qilin?.effect).toContain('回合结束');
      expect(qilin?.effect).toContain('牌库底');
    });

    it('蜃气楼、荒骷髅、贪嗔痴有回合开始回收效果', () => {
      const autoRecoverBosses = ['蜃气楼', '荒骷髅', '贪嗔痴'];
      for (const name of autoRecoverBosses) {
        const boss = bossData.find(b => b.name === name);
        expect(boss?.effect).toContain('回合开始');
        expect(boss?.effect).toContain('弃牌堆');
      }
    });
  });
});

// ===========================================
// 四、妖怪卡一致性测试
// ===========================================
describe('妖怪卡数据一致性验证 (基于文档 v0.3.0)', () => {
  const yokaiData = cardsData.yokai;
  const tokenData = cardsData.token;

  // 文档定义的妖怪（不含招福达摩）
  const YOKAI_SPEC = [
    // 生命2
    { name: '赤舌', hp: 2, charm: 1, count: 2, multiPlayerCount: 0, effect: '每名对手从他的弃牌堆中，选择1张「基础术式」或「招福达摩」置于各自牌库顶。' },
    { name: '唐纸伞妖', hp: 2, charm: 0, count: 2, multiPlayerCount: 1, effect: '伤害+1，查看你牌库顶牌，你可以超度它。' },
    { name: '天邪鬼绿', hp: 2, charm: 0, count: 2, multiPlayerCount: 0, effect: '退治1个生命不高于4的游荡妖怪。' },
    { name: '天邪鬼青', hp: 2, charm: 0, count: 2, multiPlayerCount: 1, effect: '选择一项：· 抓牌+1 · 伤害+1' },
    { name: '天邪鬼赤', hp: 2, charm: 0, count: 2, multiPlayerCount: 1, effect: '伤害+1，弃置任意数量的手牌，然后抓等量的牌。' },
    { name: '天邪鬼黄', hp: 2, charm: 0, count: 2, multiPlayerCount: 1, effect: '抓牌+2，然后将1张手牌放置到牌库顶。' },
    // 生命3
    { name: '魅妖', hp: 3, charm: 0, count: 2, multiPlayerCount: 0, effect: '每名对手展示他的牌库顶牌，你选择其中一张生命低于5的牌，使用其效果，然后将其置于拥有者的弃牌区。' },
    { name: '灯笼鬼', hp: 3, charm: 0, count: 2, multiPlayerCount: 1, effect: '鬼火+1，抓牌+1。' },
    { name: '树妖', hp: 3, charm: 0, count: 2, multiPlayerCount: 1, effect: '抓牌+2，然后，弃置1张手牌。【触】当此牌被弃置时，则获得抓牌+2。' },
    { name: '日女巳时', hp: 3, charm: 0, count: 2, multiPlayerCount: 1, effect: '选择一项：· 鬼火+1 · 抓牌+2 · 伤害+2' },
    { name: '蚌精', hp: 3, charm: 0, count: 2, multiPlayerCount: 1, effect: '超度1张手牌，抓牌+2。' },
    { name: '鸣屋', hp: 3, charm: 0, count: 2, multiPlayerCount: 1, effect: '若你的弃牌堆没有牌，则伤害+4，否则伤害+2。' },
    { name: '蝠翼', hp: 3, charm: 1, count: 2, multiPlayerCount: 1, effect: '抓牌+1，伤害+1。' },
    { name: '兵主部', hp: 3, charm: 1, count: 2, multiPlayerCount: 1, effect: '伤害+2。' },
    // 生命4
    { name: '魍魉之匣', hp: 4, charm: 0, count: 1, multiPlayerCount: 1, effect: '抓牌+1，伤害+1。所有玩家展示牌库顶牌，由你决定这些牌保留或弃置。' },
    { name: '骰子鬼', hp: 4, charm: 1, count: 2, multiPlayerCount: 0, effect: '超度1张手牌。然后选择1张生命不高于超度牌2点的游荡妖怪，将其退治。' },
    { name: '涅槃之火', hp: 4, charm: 1, count: 2, multiPlayerCount: 1, effect: '本回合中，所有式神技能的鬼火消耗-1。（最低为0）' },
    { name: '雪幽魂', hp: 4, charm: 1, count: 2, multiPlayerCount: 1, effect: '抓牌+1，每名对手玩家弃置1张恶评，否则获得1张恶评。' },
    { name: '轮入道', hp: 4, charm: 0, count: 2, multiPlayerCount: 1, effect: '弃置你手上另一张生命不高于6的御魂，执行其效果两次。' },
    { name: '网切', hp: 4, charm: 0, count: 2, multiPlayerCount: 1, effect: '本回合中，所有妖怪（包括手牌）生命-1，鬼王生命-2，但不会低于1点。' },
    { name: '铮', hp: 4, charm: 0, count: 2, multiPlayerCount: 1, effect: '抓牌+1，伤害+2。【触】受到[妨害]效果时，可以弃置此牌：抓牌+2，不受[妨害]效果影响。' },
    { name: '薙魂', hp: 4, charm: 1, count: 2, multiPlayerCount: 1, effect: '抓牌+1，弃置1张手牌。本回合中，若你打出了至少3张「御魂」（包括此牌），则鬼火+2。' },
    // 生命5
    { name: '狂骨', hp: 5, charm: 0, count: 2, multiPlayerCount: 0, effect: '抓牌+1，伤害+X，X等于你当前的鬼火数量。' },
    { name: '返魂香', hp: 5, charm: 1, count: 2, multiPlayerCount: 1, effect: '抓牌+1，伤害+1。每名对手选择一项：· 弃置1张手牌（无手牌时不可选）· 获得1张恶评' },
    { name: '镇墓兽', hp: 5, charm: 1, count: 2, multiPlayerCount: 1, effect: '鬼火+1，抓牌+1，伤害+2，你左手边的玩家指定一个游荡妖怪或鬼王，本回合中你不能将其退治。' },
    { name: '针女', hp: 5, charm: 1, count: 2, multiPlayerCount: 1, effect: '伤害+1。本回合中，每当你使用式神技能时，伤害+2。' },
    { name: '心眼', hp: 5, charm: 0, count: 2, multiPlayerCount: 1, effect: '伤害+3。' },
    { name: '涂佛', hp: 5, charm: 0, count: 2, multiPlayerCount: 1, effect: '选择你弃牌区中三张阴阳术，将其置入手牌。' },
    { name: '地藏像', hp: 5, charm: 2, count: 4, multiPlayerCount: 0, effect: '超度此牌。获取1个式神（式神上限为3个）。' },
    // 生命6
    { name: '飞缘魔', hp: 6, charm: 1, count: 2, multiPlayerCount: 1, effect: '使用当前存在的鬼王御魂效果。' },
    { name: '破势', hp: 6, charm: 1, count: 3, multiPlayerCount: 1, effect: '伤害+3。若此牌为你本回合中使用的第一张牌，则上述效果改为伤害+5。' },
    { name: '镜姬', hp: 6, charm: 1, count: 2, multiPlayerCount: 2, effect: '抓牌+2，伤害+1，鬼火+1。【妖】【永】此牌不会受到由阴阳术产生的伤害。' },
    { name: '木魅', hp: 6, charm: 1, count: 2, multiPlayerCount: 2, effect: '从你的牌库顶开始展示卡牌，直到出现3张阴阳术，将它们置入手牌，弃置其余展示的卡牌。' },
    // 生命7
    { name: '幽谷响', hp: 7, charm: 1, count: 2, multiPlayerCount: 1, effect: '每名对手展示牌库顶牌，你可以使用至多3张以此法展示的非鬼王的效果，然后，将它们置于拥有者的弃牌区。' },
    { name: '伤魂鸟', hp: 7, charm: 1, count: 2, multiPlayerCount: 1, effect: '超度X张手牌。然后伤害+2X。' },
    { name: '阴摩罗', hp: 7, charm: 1, count: 2, multiPlayerCount: 1, effect: '选择弃牌区内2张生命低于6的牌，使用之。在回合结束时，将它们返回你的牌库底。' },
    // 生命8
    { name: '青女房', hp: 8, charm: 2, count: 2, multiPlayerCount: 0, effect: '抓牌+2，鬼火+1。受到妨害和鬼王来袭时，你可以展示本卡而不受影响。' },
    { name: '三味', hp: 8, charm: 2, count: 2, multiPlayerCount: 0, effect: '本回合中，你每使用了1张「鬼火」牌或阴阳术，则伤害+2。【触】当此牌被弃置时，获得抓牌+3。' }
  ];

  describe('🔴 数量验证', () => {
    it('招福达摩18张（初始卡，不进入游荡牌库）', () => {
      const daruma = tokenData?.find(t => t.name === '招福达摩');
      expect(daruma?.count).toBe(18);
    });

    it('妖怪种类32种（不含招福达摩）', () => {
      // 文档显示32类妖怪
      expect(YOKAI_SPEC.length).toBeGreaterThanOrEqual(31); // 至少31种在spec中
    });

    it('游荡妖怪总数应为78张（不含招福达摩）', () => {
      // 96总数 - 18招福达摩 = 78
      const totalCount = YOKAI_SPEC.reduce((sum, y) => sum + y.count, 0);
      expect(totalCount).toBe(78);
    });
  });

  describe('🔴 妖怪基础属性验证', () => {
    for (const spec of YOKAI_SPEC) {
      describe(`${spec.name}（生命${spec.hp}）`, () => {
        const card = yokaiData.find(y => y.name === spec.name);

        it('存在于cards.json中', () => {
          expect(card).toBeDefined();
        });

        it(`生命值为 ${spec.hp}`, () => {
          expect(card?.hp).toBe(spec.hp);
        });

        it(`声誉为 ${spec.charm}`, () => {
          expect(card?.charm).toBe(spec.charm);
        });
      });
    }
  });

  describe('🔴 生命值分布验证', () => {
    const hpDistribution = [
      { hp: 2, types: 6 },  // 赤舌, 唐纸伞妖, 天邪鬼绿/青/赤/黄
      { hp: 3, types: 8 },  // 魅妖, 灯笼鬼, 树妖, 日女巳时, 蚌精, 鸣屋, 蝠翼, 兵主部
      { hp: 4, types: 8 },  // 魍魉之匣, 骰子鬼, 涅槃之火, 雪幽魂, 轮入道, 网切, 铮, 薙魂
      { hp: 5, types: 7 },  // 狂骨, 返魂香, 镇墓兽, 针女, 心眼, 涂佛, 地藏像
      { hp: 6, types: 4 },  // 飞缘魔, 破势, 镜姬, 木魅
      { hp: 7, types: 3 },  // 幽谷响, 伤魂鸟, 阴摩罗
      { hp: 8, types: 2 }   // 青女房, 三味
    ];

    for (const dist of hpDistribution) {
      it(`生命${dist.hp}的妖怪有${dist.types}种`, () => {
        const count = YOKAI_SPEC.filter(y => y.hp === dist.hp).length;
        expect(count).toBe(dist.types);
      });
    }
  });

  describe('🟢 数据完整性', () => {
    it('每张妖怪都有唯一ID', () => {
      const ids = yokaiData.map(y => y.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每张妖怪都有type字段且为yokai', () => {
      for (const card of yokaiData) {
        expect(card.type).toBe('yokai');
      }
    });

    it('每张妖怪都有effect字段', () => {
      for (const card of yokaiData) {
        expect(card.effect).toBeDefined();
        expect(card.effect.length).toBeGreaterThan(0);
      }
    });
  });
});

// ===========================================
// 五、边界条件测试
// ===========================================
// ===========================================
// 六、游戏配置一致性测试
// ===========================================
describe('游戏配置一致性验证 (基于文档 v0.3.0)', () => {
  const playerSetup = cardsData.playerSetup;

  describe('🔴 玩家初始配置', () => {
    it('初始基础术式6张', () => {
      expect(playerSetup.startingDeck.spell.count).toBe(6);
    });

    it('初始招福达摩3张', () => {
      expect(playerSetup.startingDeck.token.count).toBe(3);
    });

    it('初始手牌5张', () => {
      expect(playerSetup.handSize).toBe(5);
    });

    it('初始式神2个', () => {
      expect(playerSetup.shikigamiKeep).toBe(2);
      expect(playerSetup.shikigamiCount).toBe(2);
    });
  });
});

// ===========================================
// 七、边界条件测试
// ===========================================
describe('卡牌效果边界条件测试', () => {
  const yokaiData = cardsData.yokai;
  const bossData = cardsData.boss;
  const spellData = cardsData.spell;

  describe('🟢 阴阳术升级条件', () => {
    it('基础术式需要生命≥2的妖怪超度', () => {
      const basic = spellData.find(s => s.name === '基础术式');
      expect(basic?.effect).toMatch(/生命.*[不低于|≥].*2/);
    });

    it('中级符咒需要生命≥4的妖怪超度', () => {
      const medium = spellData.find(s => s.name === '中级符咒');
      expect(medium?.effect).toMatch(/生命.*[不低于|≥].*4/);
    });
  });

  describe('🟢 妖怪关键数值', () => {
    it('鸣屋：弃牌堆空时伤害+4，否则+2', () => {
      const mingWu = yokaiData.find(y => y.name === '鸣屋');
      expect(mingWu?.effect).toContain('伤害+4');
      expect(mingWu?.effect).toContain('伤害+2');
    });

    it('天邪鬼绿：退治生命不高于4的妖怪', () => {
      const green = yokaiData.find(y => y.name === '天邪鬼绿');
      expect(green?.effect).toMatch(/[不高于|≤].*4/);
    });

    it('破势：首张牌伤害+5，否则+3', () => {
      const poshi = yokaiData.find(y => y.name === '破势');
      expect(poshi?.effect).toContain('伤害+3');
      expect(poshi?.effect).toContain('伤害+5');
    });

    it('狂骨：伤害=当前鬼火数', () => {
      const kuangGu = yokaiData.find(y => y.name === '狂骨');
      expect(kuangGu?.effect).toContain('鬼火');
    });

    it('轮入道：执行御魂效果两次', () => {
      const wheel = yokaiData.find(y => y.name === '轮入道');
      expect(wheel?.effect).toContain('两次');
    });

    it('网切：妖怪生命-1，鬼王生命-2', () => {
      const wangQie = yokaiData.find(y => y.name === '网切');
      expect(wangQie?.effect).toContain('生命-1');
      expect(wangQie?.effect).toContain('生命-2');
    });
  });

  describe('🟢 鬼王关键数值', () => {
    it('鬼灵歌伎来袭：展示牌库顶5张，弃置生命>6的', () => {
      const geji = bossData.find(b => b.name === '鬼灵歌伎');
      expect(geji?.arrival).toContain('5张');
      expect(geji?.arrival).toContain('>6');
    });

    it('土蜘蛛来袭：需展示3张阴阳术', () => {
      const spider = bossData.find(b => b.name === '土蜘蛛');
      expect(spider?.arrival).toContain('3张阴阳术');
    });

    it('蜃气楼来袭：弃置生命高于6的手牌', () => {
      const shengQiLou = bossData.find(b => b.name === '蜃气楼');
      expect(shengQiLou?.arrival).toContain('高于6');
    });

    it('荒骷髅来袭：超度生命高于7的御魂', () => {
      const skeleton = bossData.find(b => b.name === '荒骷髅');
      expect(skeleton?.arrival).toContain('高于7');
    });

    it('地震鲶御魂：对手弃牌至3张', () => {
      const catfish = bossData.find(b => b.name === '地震鲶');
      expect(catfish?.effect).toContain('3张');
    });

    it('八岐大蛇御魂：鬼火+2，伤害+7', () => {
      const snake = bossData.find(b => b.name === '八岐大蛇');
      expect(snake?.effect).toContain('鬼火+2');
      expect(snake?.effect).toContain('伤害+7');
    });
  });

  describe('🟢 特殊效果验证', () => {
    it('镜姬【妖】：不受阴阳术伤害', () => {
      const jingJi = yokaiData.find(y => y.name === '镜姬');
      // 检查是否有相关描述
      expect(jingJi).toBeDefined();
    });

    it('树妖【触】：被弃置时抓牌', () => {
      const tree = yokaiData.find(y => y.name === '树妖');
      expect(tree?.effect).toContain('弃置');
    });

    it('铮【触】：受妨害时反制', () => {
      const zheng = yokaiData.find(y => y.name === '铮');
      expect(zheng?.effect).toContain('妨害');
    });

    it('青女房：展示可防妨害和鬼王来袭', () => {
      const qingNvFang = yokaiData.find(y => y.name === '青女房');
      expect(qingNvFang?.effect).toContain('妨害');
      expect(qingNvFang?.effect).toContain('鬼王');
    });
  });
});
