
/**
 * 御魂传说 - 数据加载器测试
 * @file shared/data/loader.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getCardDatabase,
  getAllOnmyoji,
  getAllShikigami,
  getAllSpells,
  getAllTokens,
  getAllPenalties,
  getAllBosses,
  getAllYokai,
  getYokaiForPlayerCount,
  getSpellsByTier,
  createStartingDeck,
  getGameConfig,
  GAME_CONSTANTS,
  DATA_SUMMARY
} from './loader';

describe('CardLoader 数据加载器', () => {

  describe('🟢 数据库加载', () => {
    it('数据库版本为0.3.0', () => {
      const db = getCardDatabase();
      expect(db.version).toBe('0.3.0');
    });

    it('数据摘要包含正确的版本', () => {
      expect(DATA_SUMMARY.version).toBe('0.3.0');
    });
  });

  describe('🟢 阴阳师', () => {
    it('有6个阴阳师', () => {
      const onmyoji = getAllOnmyoji();
      expect(onmyoji.length).toBe(6);
    });

    it('阴阳师没有技能（为了平衡）', () => {
      const onmyoji = getAllOnmyoji();
      // 阴阳师应该只有名称和形象，无技能
      onmyoji.forEach(o => {
        expect(o.skill).toBeUndefined();
      });
    });
  });

  describe('🟢 式神', () => {
    it('有24个式神', () => {
      const shikigami = getAllShikigami();
      expect(shikigami.length).toBe(24);
    });

    it('式神有稀有度和声誉', () => {
      const shikigami = getAllShikigami();
      shikigami.forEach(s => {
        expect(['SSR', 'SR', 'R']).toContain(s.rarity);
        expect(s.charm).toBeGreaterThanOrEqual(1);
        expect(s.charm).toBeLessThanOrEqual(3);
      });
    });

    it('SSR式神声誉为3', () => {
      const shikigami = getAllShikigami();
      const ssr = shikigami.filter(s => s.rarity === 'SSR');
      ssr.forEach(s => expect(s.charm).toBe(3));
    });

    it('有6个多人专属式神', () => {
      // 百目鬼、铁鼠、丑时之女、巫蛊师、独眼小僧、食梦貘
      const shikigami = getAllShikigami();
      const multiPlayer = shikigami.filter(s => s.multiPlayer === true);
      expect(multiPlayer.length).toBe(6);
    });
  });

  describe('🟢 阴阳术', () => {
    it('有3种阴阳术', () => {
      const spells = getAllSpells();
      expect(spells.length).toBe(3);
    });

    it('基础术式有50张', () => {
      const basic = getSpellsByTier('basic');
      expect(basic.length).toBe(1);
      expect(basic[0]!.count).toBe(50);
    });

    it('中级符咒有20张', () => {
      const medium = getSpellsByTier('medium');
      expect(medium[0]!.count).toBe(20);
    });

    it('高级符咒有10张', () => {
      const advanced = getSpellsByTier('advanced');
      expect(advanced[0]!.count).toBe(10);
    });
  });

  describe('🟢 令牌', () => {
    it('招福达摩生命值为1', () => {
      const tokens = getAllTokens();
      const daruma = tokens.find(t => t.name === '招福达摩');
      expect(daruma?.hp).toBe(1);
    });

    it('招福达摩声誉为1', () => {
      const tokens = getAllTokens();
      const daruma = tokens.find(t => t.name === '招福达摩');
      expect(daruma?.charm).toBe(1);
    });
  });

  describe('🟢 恶评', () => {
    it('有2种恶评（农夫和武士）', () => {
      const penalties = getAllPenalties();
      expect(penalties.length).toBe(2);
    });

    it('农夫声誉为-1', () => {
      const penalties = getAllPenalties();
      const farmer = penalties.find(p => p.name === '农夫');
      expect(farmer?.charm).toBe(-1);
    });

    it('武士声誉为-2', () => {
      const penalties = getAllPenalties();
      const warrior = penalties.find(p => p.name === '武士');
      expect(warrior?.charm).toBe(-2);
    });
  });

  describe('🟢 游荡妖怪', () => {
    it('有38种妖怪（不含招福达摩）', () => {
      const yokai = getAllYokai();
      expect(yokai.length).toBe(38);
    });

    it('4人以下游戏过滤多人妖怪', () => {
      const all = getAllYokai();
      const filtered = getYokaiForPlayerCount(4);
      expect(filtered.length).toBeLessThan(all.length);
    });

    it('5人以上游戏使用全部妖怪', () => {
      const all = getAllYokai();
      const forFive = getYokaiForPlayerCount(5);
      expect(forFive.length).toBe(all.length);
    });
  });

  describe('🟢 鬼王', () => {
    it('有10个鬼王', () => {
      const bosses = getAllBosses();
      expect(bosses.length).toBe(10);
    });
  });

  describe('🟢 游戏常量', () => {
    it('鬼火上限为5', () => {
      expect(GAME_CONSTANTS.maxGhostFire).toBe(5);
    });

    it('每回合获得1点鬼火', () => {
      expect(GAME_CONSTANTS.ghostFirePerTurn).toBe(1);
    });

    it('战场有6个妖怪槽位', () => {
      expect(GAME_CONSTANTS.yokaiSlots).toBe(6);
    });

    it('式神上限为3', () => {
      expect(GAME_CONSTANTS.maxShikigami).toBe(3);
    });
  });

  describe('🟢 初始牌库', () => {
    it('初始牌库有9张牌（6基础+3达摩）', () => {
      const deck = createStartingDeck();
      expect(deck.length).toBe(9);
    });

    it('初始牌库有6张基础术式', () => {
      const deck = createStartingDeck();
      const spells = deck.filter(c => c.name === '基础术式');
      expect(spells.length).toBe(6);
    });

    it('初始牌库有3张招福达摩', () => {
      const deck = createStartingDeck();
      const daruma = deck.filter(c => c.name === '招福达摩');
      expect(daruma.length).toBe(3);
    });
  });

  describe('🟢 游戏配置', () => {
    it('4人游戏配置正确', () => {
      const config = getGameConfig(4);
      expect(config.playerCount).toBe(4);
      expect(config.maxGhostFire).toBe(5);
    });
  });
});
