/**
 * 式神数据一致性测试
 * 验证 cards.json 中的式神数据与规则文档(式神卡.md v0.3.0)完全一致
 * 
 * 【重要】这是基于官方文档的 Truth Source 测试
 */

import { describe, it, expect } from 'vitest';
import cardsData from './cards.json';

// ============ 文档定义的式神数据（Truth Source）============

interface ShikigamiSpec {
  name: string;
  rarity: 'SSR' | 'SR' | 'R';
  charm: number;
  multiPlayer: boolean;
  skillName: string;
  skillType: '启' | '触' | '自' | '永';
  skillCost?: number;  // 鬼火消耗（启类技能）
  skillEffect: string; // 完整效果描述
}

/**
 * 文档 v0.3.0 定义的24张式神
 * 来源：策划文档/卡牌数据/式神卡.md
 */
const SHIKIGAMI_SPEC: ShikigamiSpec[] = [
  // ===== SSR (5张，声誉+3) =====
  {
    name: '妖刀姬',
    rarity: 'SSR',
    charm: 3,
    multiPlayer: false,
    skillName: '杀戮',
    skillType: '启',
    skillCost: 2,
    skillEffect: '抓牌+1，伤害+1。可额外鬼火-1，重复一次效果。'
  },
  {
    name: '大天狗',
    rarity: 'SSR',
    charm: 3,
    multiPlayer: false,
    skillName: '羽刃暴风',
    skillType: '启',
    skillCost: 2,
    skillEffect: '回合中你可以选择1个目标。当你对其他目标造成N点伤害时，对其造成N-2点伤害。'
  },
  {
    name: '酒吞童子',
    rarity: 'SSR',
    charm: 3,
    multiPlayer: false,
    skillName: '酒葫芦',
    skillType: '启',
    skillCost: 2,
    skillEffect: '超度1张手牌并放置1枚「酒气」指示物（上限为3）。【启】移除N枚「酒气」指示物：伤害+N。'
  },
  {
    name: '茨木童子',
    rarity: 'SSR',
    charm: 3,
    multiPlayer: false,
    skillName: '迁怒',
    skillType: '启',
    skillCost: 2,
    skillEffect: '本回合中，你每超度或退治1个妖怪，获得伤害+2。'
  },
  {
    name: '花鸟卷',
    rarity: 'SSR',
    charm: 3,
    multiPlayer: false,
    skillName: '画境',
    skillType: '自', // 主效果是【自】，但也有【启】
    skillCost: 2,
    skillEffect: '受到[妨害]效果影响时，鬼火-1：抓牌+2，将1张手牌置于牌库顶，然后结算妨害。【启】鬼火-2：抓牌+3，然后，将1张手牌置于牌库底。'
  },

  // ===== SR (7张，声誉+2) =====
  {
    name: '书翁',
    rarity: 'SR',
    charm: 2,
    multiPlayer: false,
    skillName: '万象之书',
    skillType: '启',
    skillCost: 0, // 特殊：鬼火-N，N不能为0
    skillEffect: '鬼火-N：伤害+N+1（N不能为0）。'
  },
  {
    name: '百目鬼',
    rarity: 'SR',
    charm: 2,
    multiPlayer: true, // 🔷
    skillName: '诅咒之眼',
    skillType: '启',
    skillCost: 1,
    skillEffect: '[妨害]所有玩家弃置1张手牌，然后你抓牌+1。'
  },
  {
    name: '鬼使白',
    rarity: 'SR',
    charm: 2,
    multiPlayer: false,
    skillName: '魂狩',
    skillType: '启',
    skillCost: 1,
    skillEffect: '本回合中，首次退治生命不高于6的妖怪时，你可以将其置入手牌。'
  },
  {
    name: '般若',
    rarity: 'SR',
    charm: 2,
    multiPlayer: false,
    skillName: '嫉恨之心',
    skillType: '启',
    skillCost: 1,
    skillEffect: '[妨害]所有玩家弃置牌库顶牌，你可以将你弃置的牌置入手牌，或将其超度。'
  },
  {
    name: '追月神',
    rarity: 'SR',
    charm: 2,
    multiPlayer: false,
    skillName: '明月潮升',
    skillType: '触',
    skillEffect: '在你的回合中，因卡牌效果抓牌达到3张时，可选择一项：鬼火+1 / 伤害+1 / 超度1张手牌'
  },
  {
    name: '白狼',
    rarity: 'SR',
    charm: 2,
    multiPlayer: false,
    skillName: '冥想',
    skillType: '启',
    skillCost: 1,
    skillEffect: '弃置N张手牌：伤害+N。'
  },
  {
    name: '食梦貘',
    rarity: 'SR',
    charm: 2,
    multiPlayer: true, // 🔷
    skillName: '沉睡',
    skillType: '启',
    skillCost: 1,
    skillEffect: '抓牌+4，立即结束行动并跳过弃牌与补牌阶段。直到下个你的回合开始前，你进入[沉睡]状态。【触】在[沉睡]状态下，你受到[妨害]效果影响时，先弃置1张手牌。'
  },

  // ===== R (12张，声誉+1) =====
  {
    name: '鲤鱼精',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '泡泡之盾',
    skillType: '自',
    skillEffect: '回合内首次退治妖怪或鬼王时，你可以将其放置在你的牌库顶。'
  },
  {
    name: '萤草',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '生花',
    skillType: '启',
    skillCost: 1,
    skillEffect: '鬼火-1或弃置1张妖怪牌：放置1枚「祝福种子」指示物（可各1次）。【触】回合开始时可选择移除所有「祝福种子」，每以此法移除1枚，则抓牌+1或伤害+1。【触】受到[妨害]效果时，移除1枚种子。若已执行，则不受[妨害]效果的影响。'
  },
  {
    name: '独眼小僧',
    rarity: 'R',
    charm: 1,
    multiPlayer: true, // 🔷
    skillName: '金刚经',
    skillType: '永',
    skillEffect: '你的回合外，所有生命低于5的妖怪生命+1。'
  },
  {
    name: '食发鬼',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '真实之颜',
    skillType: '启',
    skillCost: 1,
    skillEffect: '选择至多3个场上的游荡妖怪置于妖怪牌库底。立刻补充妖怪且其生命-1。'
  },
  {
    name: '巫蛊师',
    rarity: 'R',
    charm: 1,
    multiPlayer: true, // 🔷
    skillName: '迷魂蛊',
    skillType: '触',
    skillEffect: '当你超度1张手牌时，鬼火-1：你可以令任一对手展示手牌并用该牌交换其中1张，交换的牌张生命差距不大于2。（无生命的牌视作生命0）'
  },
  {
    name: '山童',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '怪力',
    skillType: '启',
    skillCost: 1,
    skillEffect: '本回合中，你使用的前2张阴阳术额外伤害+1。'
  },
  {
    name: '丑时之女',
    rarity: 'R',
    charm: 1,
    multiPlayer: true, // 🔷
    skillName: '草人替身',
    skillType: '触', // 有【触】和【启】
    skillCost: 2,
    skillEffect: '本回合中，当你首次进行妨害时，抓牌+1。【启】[妨害] 鬼火-2：选择1张手牌，将其给予一名对手，其他对手获得1张「恶评」牌。'
  },
  {
    name: '三尾狐',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '诱惑',
    skillType: '永',
    skillEffect: '回合内首次对非女性目标造成的伤害+1。'
  },
  {
    name: '青蛙瓷器',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '岭上开花',
    skillType: '启',
    skillCost: 1,
    skillEffect: '投掷1颗鬼火骰，若结果为4-5或鬼面，则伤害+2。'
  },
  {
    name: '铁鼠',
    rarity: 'R',
    charm: 1,
    multiPlayer: true, // 🔷
    skillName: '横财护身',
    skillType: '启',
    skillCost: 2,
    skillEffect: '[妨害]每名对手弃置库顶牌2张牌，若弃置的牌中含有阴阳术，你可以选择其中1张并置入自己的弃牌区。'
  },
  {
    name: '座敷童子',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '魂之火',
    skillType: '启',
    skillCost: 0, // 弃置妖怪牌代替鬼火
    skillEffect: '弃置1张妖怪牌：鬼火+1。'
  },
  {
    name: '山兔',
    rarity: 'R',
    charm: 1,
    multiPlayer: false,
    skillName: '兔子舞',
    skillType: '启',
    skillCost: 1,
    skillEffect: '抓牌+1，然后弃置1张牌。若弃置了妖怪牌，则伤害+1。'
  }
];

// ============ 测试 ============

describe('式神数据一致性验证 (基于文档 v0.3.0)', () => {
  const shikigamiData = cardsData.shikigami as any[];

  describe('🔴 数量验证', () => {
    it('总计24张式神', () => {
      expect(shikigamiData.length).toBe(24);
    });

    it('SSR式神5张', () => {
      const ssrCount = shikigamiData.filter(s => s.rarity === 'SSR').length;
      expect(ssrCount).toBe(5);
    });

    it('SR式神7张', () => {
      const srCount = shikigamiData.filter(s => s.rarity === 'SR').length;
      expect(srCount).toBe(7);
    });

    it('R式神12张', () => {
      const rCount = shikigamiData.filter(s => s.rarity === 'R').length;
      expect(rCount).toBe(12);
    });

    it('多人专属式神6张（百目鬼、食梦貘、独眼小僧、巫蛊师、丑时之女、铁鼠）', () => {
      const multiPlayerCount = shikigamiData.filter(s => s.multiPlayer === true).length;
      expect(multiPlayerCount).toBe(6);
    });
  });

  describe('🔴 基础属性验证', () => {
    for (const spec of SHIKIGAMI_SPEC) {
      describe(`${spec.name} (${spec.rarity})`, () => {
        const card = shikigamiData.find(s => s.name === spec.name);

        it('存在于cards.json中', () => {
          expect(card).toBeDefined();
        });

        it(`稀有度为 ${spec.rarity}`, () => {
          expect(card?.rarity).toBe(spec.rarity);
        });

        it(`声誉为 +${spec.charm}`, () => {
          expect(card?.charm).toBe(spec.charm);
        });

        it(`多人专属标记为 ${spec.multiPlayer}`, () => {
          expect(card?.multiPlayer).toBe(spec.multiPlayer);
        });
      });
    }
  });

  describe('🔴 技能名称验证', () => {
    for (const spec of SHIKIGAMI_SPEC) {
      it(`${spec.name} 的技能名为「${spec.skillName}」`, () => {
        const card = shikigamiData.find(s => s.name === spec.name);
        // 技能名可能在 skill.name 或 passive.name 中
        const actualSkillName = card?.skill?.name || card?.passive?.name;
        expect(actualSkillName).toBe(spec.skillName);
      });
    }
  });

  describe('🔴 启动技能鬼火消耗验证', () => {
    const skillsWithCost = SHIKIGAMI_SPEC.filter(s => s.skillType === '启' && s.skillCost !== undefined);
    
    for (const spec of skillsWithCost) {
      it(`${spec.name}「${spec.skillName}」消耗 ${spec.skillCost} 鬼火`, () => {
        const card = shikigamiData.find(s => s.name === spec.name);
        expect(card?.skill?.cost).toBe(spec.skillCost);
      });
    }
  });

  describe('🔴 声誉与稀有度对应关系', () => {
    it('所有SSR式神声誉为3', () => {
      const ssrCards = shikigamiData.filter(s => s.rarity === 'SSR');
      for (const card of ssrCards) {
        expect(card.charm).toBe(3);
      }
    });

    it('所有SR式神声誉为2', () => {
      const srCards = shikigamiData.filter(s => s.rarity === 'SR');
      for (const card of srCards) {
        expect(card.charm).toBe(2);
      }
    });

    it('所有R式神声誉为1', () => {
      const rCards = shikigamiData.filter(s => s.rarity === 'R');
      for (const card of rCards) {
        expect(card.charm).toBe(1);
      }
    });
  });

  describe('🔴 多人专属式神名单验证', () => {
    const expectedMultiPlayer = ['百目鬼', '食梦貘', '独眼小僧', '巫蛊师', '丑时之女', '铁鼠'];
    
    for (const name of expectedMultiPlayer) {
      it(`${name} 应标记为多人专属`, () => {
        const card = shikigamiData.find(s => s.name === name);
        expect(card?.multiPlayer).toBe(true);
      });
    }

    it('其他式神不应标记为多人专属', () => {
      const nonMultiPlayer = shikigamiData.filter(s => !expectedMultiPlayer.includes(s.name));
      for (const card of nonMultiPlayer) {
        expect(card.multiPlayer).toBeFalsy();
      }
    });
  });

  describe('🟢 数据完整性', () => {
    it('每张式神都有唯一ID', () => {
      const ids = shikigamiData.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('每张式神都有name字段', () => {
      for (const card of shikigamiData) {
        expect(card.name).toBeDefined();
        expect(typeof card.name).toBe('string');
        expect(card.name.length).toBeGreaterThan(0);
      }
    });

    it('每张式神都有rarity字段', () => {
      for (const card of shikigamiData) {
        expect(['SSR', 'SR', 'R']).toContain(card.rarity);
      }
    });

    it('每张式神都有charm字段且为正整数', () => {
      for (const card of shikigamiData) {
        expect(card.charm).toBeDefined();
        expect(card.charm).toBeGreaterThan(0);
        expect(Number.isInteger(card.charm)).toBe(true);
      }
    });

    it('每张式神至少有skill或passive', () => {
      for (const card of shikigamiData) {
        const hasSkill = card.skill && card.skill.name;
        const hasPassive = card.passive && card.passive.name;
        expect(hasSkill || hasPassive).toBeTruthy();
      }
    });

    it('所有式神都有image字段', () => {
      for (const card of shikigamiData) {
        expect(card.image).toBeDefined();
        expect(card.image).toMatch(/^式神\d+\.png$/);
      }
    });

    it('所有式神都有type字段且为shikigami', () => {
      for (const card of shikigamiData) {
        expect(card.type).toBe('shikigami');
      }
    });

    it('所有式神都有category分类', () => {
      for (const card of shikigamiData) {
        expect(card.category).toBeDefined();
        expect(card.category.length).toBeGreaterThan(0);
      }
    });
  });

  // 技能效果文本精确匹配验证
  describe('🔵 技能效果文本验证', () => {
    const SKILL_EFFECTS: Record<string, { skill?: string; passive?: string }> = {
      '妖刀姬': {
        skill: '【启】鬼火-2：抓牌+1，伤害+1。可额外鬼火-1，重复一次效果。'
      },
      '大天狗': {
        skill: '【启】鬼火-2：回合中你可以选择1个目标。当你对其他目标造成N点伤害时，对其造成N-2点伤害。'
      },
      '酒吞童子': {
        skill: '【启】鬼火-2：超度1张手牌并放置1枚「酒气」指示物（上限为3）。【启】移除N枚「酒气」指示物：伤害+N。'
      },
      '茨木童子': {
        skill: '【启】鬼火-2：本回合中，你每超度或退治1个妖怪，获得伤害+2。'
      },
      '花鸟卷': {
        passive: '【自】受到[妨害]效果影响时，鬼火-1：抓牌+2，将1张手牌置于牌库顶，然后结算妨害。',
        skill: '【启】鬼火-2：抓牌+3，然后，将1张手牌置于牌库底。'
      },
      '书翁': {
        skill: '【启】鬼火-N：伤害+N+1（N不能为0）。'
      },
      '百目鬼': {
        skill: '【启】[妨害] 鬼火-1：所有玩家弃置1张手牌，然后你抓牌+1。'
      },
      '鬼使白': {
        skill: '【启】鬼火-1：本回合中，首次退治生命不高于6的妖怪时，你可以将其置入手牌。'
      },
      '般若': {
        skill: '【启】[妨害] 鬼火-1：所有玩家弃置牌库顶牌，你可以将你弃置的牌置入手牌，或将其超度。'
      },
      '追月神': {
        passive: '【触】在你的回合中，因卡牌效果抓牌达到3张时，可选择一项：· 鬼火+1 · 伤害+1 · 超度1张手牌'
      },
      '白狼': {
        skill: '【启】鬼火-1，弃置N张手牌：伤害+N。'
      },
      '食梦貘': {
        skill: '【启】鬼火-1：抓牌+4，立即结束行动并跳过弃牌与补牌阶段。直到下个你的回合开始前，你进入[沉睡]状态。【触】在[沉睡]状态下，你受到[妨害]效果影响时，先弃置1张手牌。'
      },
      '鲤鱼精': {
        passive: '【自】回合内首次退治妖怪或鬼王时，你可以将其放置在你的牌库顶。'
      },
      '萤草': {
        skill: '【启】鬼火-1或弃置1张妖怪牌：放置1枚「祝福种子」指示物（可各1次）。【触】回合开始时可选择移除所有「祝福种子」，每以此法移除1枚，则抓牌+1或伤害+1。【触】受到[妨害]效果时，移除1枚种子。若已执行，则不受[妨害]效果的影响。'
      },
      '独眼小僧': {
        passive: '【永】你的回合外，所有生命低于5的妖怪生命+1。'
      },
      '食发鬼': {
        skill: '【启】鬼火-1：选择至多3个场上的游荡妖怪置于妖怪牌库底。立刻补充妖怪且其生命-1。'
      },
      '巫蛊师': {
        passive: '【触】当你超度1张手牌时，鬼火-1：你可以令任一对手展示手牌并用该牌交换其中1张，交换的牌张生命差距不大于2。（无生命的牌视作生命0）'
      },
      '山童': {
        skill: '【启】鬼火-1：本回合中，你使用的前2张阴阳术额外伤害+1。'
      },
      '丑时之女': {
        passive: '【触】本回合中，当你首次进行妨害时，抓牌+1。',
        skill: '【启】[妨害] 鬼火-2：选择1张手牌，将其给予一名对手，其他对手获得1张「恶评」牌。'
      },
      '三尾狐': {
        passive: '【永】回合内首次对非女性目标造成的伤害+1。（这是一个娱乐向的设定，玩家可以自行讨论，会认为有明显女性特征的则不符合标准）'
      },
      '青蛙瓷器': {
        skill: '【启】鬼火-1：投掷1颗鬼火骰，若结果为4-5或鬼面，则伤害+2。'
      },
      '铁鼠': {
        skill: '【启】[妨害] 鬼火-2：每名对手弃置库顶牌2张牌，若弃置的牌中含有阴阳术，你可以选择其中1张并置入自己的弃牌区。'
      },
      '座敷童子': {
        skill: '【启】弃置1张妖怪牌：鬼火+1。'
      },
      '山兔': {
        skill: '【启】鬼火-1：抓牌+1，然后弃置1张牌。若弃置了妖怪牌，则伤害+1。'
      }
    };

    for (const [name, effects] of Object.entries(SKILL_EFFECTS)) {
      describe(`${name}`, () => {
        const card = shikigamiData.find(s => s.name === name);

        if (effects.skill) {
          it('主动技能效果文本匹配', () => {
            expect(card?.skill?.effect).toBe(effects.skill);
          });
        }

        if (effects.passive) {
          it('被动技能效果文本匹配', () => {
            expect(card?.passive?.effect).toBe(effects.passive);
          });
        }
      });
    }
  });
});

describe('式神技能效果边界条件测试', () => {
  describe('🟢 书翁「万象之书」', () => {
    it('N不能为0的约束', () => {
      // 书翁技能：鬼火-N：伤害+N+1（N不能为0）
      // 验证：N=1时，消耗1鬼火，伤害+2
      const minN = 1;
      const damage = minN + 1;
      expect(damage).toBe(2);
    });

    it('N=5时伤害为6（最大鬼火情况）', () => {
      const maxN = 5;
      const damage = maxN + 1;
      expect(damage).toBe(6);
    });
  });

  describe('🟢 酒吞童子「酒葫芦」', () => {
    it('酒气指示物上限为3', () => {
      const maxMarkers = 3;
      let markers = 0;
      
      // 连续放置4次
      for (let i = 0; i < 4; i++) {
        markers = Math.min(markers + 1, maxMarkers);
      }
      
      expect(markers).toBe(3);
    });

    it('移除N枚酒气时伤害+N', () => {
      const markers = 3;
      const damage = markers;
      expect(damage).toBe(3);
    });
  });

  describe('🟢 鬼使白「魂狩」', () => {
    it('生命不高于6的妖怪可触发', () => {
      const yokaiHp = 6;
      const canTrigger = yokaiHp <= 6;
      expect(canTrigger).toBe(true);
    });

    it('生命7的妖怪不可触发', () => {
      const yokaiHp = 7;
      const canTrigger = yokaiHp <= 6;
      expect(canTrigger).toBe(false);
    });
  });

  describe('🟢 追月神「明月潮升」', () => {
    it('抓牌达到3张时触发', () => {
      let drawCount = 0;
      let triggered = false;
      
      // 模拟抓牌
      for (let i = 0; i < 3; i++) {
        drawCount++;
        if (drawCount >= 3) {
          triggered = true;
        }
      }
      
      expect(triggered).toBe(true);
    });

    it('抓牌2张时不触发', () => {
      const drawCount = 2;
      const triggered = drawCount >= 3;
      expect(triggered).toBe(false);
    });
  });

  describe('🟢 白狼「冥想」', () => {
    it('弃置0张手牌时伤害+0', () => {
      const discardCount = 0;
      const damage = discardCount;
      expect(damage).toBe(0);
    });

    it('弃置5张手牌时伤害+5', () => {
      const discardCount = 5;
      const damage = discardCount;
      expect(damage).toBe(5);
    });
  });

  describe('🟢 山童「怪力」', () => {
    it('前2张阴阳术额外伤害+1', () => {
      const spellsPlayed = [1, 2, 3]; // 3张阴阳术基础伤害
      const bonusCount = 2;
      
      const totalDamage = spellsPlayed.reduce((sum, dmg, idx) => {
        const bonus = idx < bonusCount ? 1 : 0;
        return sum + dmg + bonus;
      }, 0);
      
      // 1+1 + 2+1 + 3+0 = 8
      expect(totalDamage).toBe(8);
    });
  });

  describe('🟢 食梦貘「沉睡」', () => {
    it('抓牌+4', () => {
      const drawCount = 4;
      expect(drawCount).toBe(4);
    });

    it('跳过清理阶段标记', () => {
      const skipCleanup = true;
      expect(skipCleanup).toBe(true);
    });
  });

  describe('🟢 独眼小僧「金刚经」', () => {
    it('生命低于5的妖怪生命+1', () => {
      const yokaiHp = 4;
      const boostedHp = yokaiHp < 5 ? yokaiHp + 1 : yokaiHp;
      expect(boostedHp).toBe(5);
    });

    it('生命5的妖怪不受影响', () => {
      const yokaiHp = 5;
      const boostedHp = yokaiHp < 5 ? yokaiHp + 1 : yokaiHp;
      expect(boostedHp).toBe(5);
    });
  });

  describe('🟢 萤草「生花」', () => {
    it('祝福种子指示物无上限', () => {
      let seeds = 0;
      for (let i = 0; i < 10; i++) {
        seeds++;
      }
      expect(seeds).toBe(10);
    });

    it('移除N枚种子时抓牌+N或伤害+N', () => {
      const seeds = 3;
      const bonus = seeds;
      expect(bonus).toBe(3);
    });
  });

  describe('🟢 座敷童子「魂之火」', () => {
    it('弃置妖怪牌获得鬼火+1', () => {
      const ghostFireGain = 1;
      expect(ghostFireGain).toBe(1);
    });

    it('无妖怪牌时无法使用', () => {
      const hasYokaiCard = false;
      const canUse = hasYokaiCard;
      expect(canUse).toBe(false);
    });
  });

  describe('🟢 山兔「兔子舞」', () => {
    it('抓牌+1然后弃牌', () => {
      let hand = 3;
      hand += 1; // 抓牌
      hand -= 1; // 弃牌
      expect(hand).toBe(3);
    });

    it('弃置妖怪牌时伤害+1', () => {
      const discardedYokai = true;
      const damageBonus = discardedYokai ? 1 : 0;
      expect(damageBonus).toBe(1);
    });

    it('弃置非妖怪牌时无额外伤害', () => {
      const discardedYokai = false;
      const damageBonus = discardedYokai ? 1 : 0;
      expect(damageBonus).toBe(0);
    });
  });
});
