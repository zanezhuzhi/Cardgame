/**
 * 御魂传说 - 回合历史记录系统测试
 * @file shared/game/effects/TurnHistory.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTurnHistory,
  recordPlayCard,
  recordUseSkill,
  recordDefeatYokai,
  recordDiscardCard,
  recordDrawCard,
  countCardsPlayed,
  countSpellsPlayed,
  countGhostFireCardsPlayed,
  countSkillsUsed,
  getDefeatedYokai,
  getPlayedCards,
  getTotalGhostFireSpent,
  hasPlayedCard,
  hasUsedShikigamiSkill,
  getDiscardedCards,
  TurnHistory,
} from '../TurnHistory';

describe('回合历史记录系统', () => {
  let history: TurnHistory;
  
  beforeEach(() => {
    history = createTurnHistory(1, 'player1');
  });
  
  describe('创建回合历史', () => {
    
    it('🟢 创建空的回合历史', () => {
      expect(history.turnNumber).toBe(1);
      expect(history.activePlayerId).toBe('player1');
      expect(history.events).toHaveLength(0);
      expect(history.startTime).toBeGreaterThan(0);
    });
    
  });
  
  describe('记录打出卡牌', () => {
    
    it('🟢 记录打出妖怪卡', () => {
      recordPlayCard(history, 'player1', 'inst_001', 'yokai_038', '三味', 'yokai', 0);
      
      expect(history.events).toHaveLength(1);
      const event = history.events[0];
      expect(event.type).toBe('playCard');
      if (event.type === 'playCard') {
        expect(event.cardName).toBe('三味');
        expect(event.cardType).toBe('yokai');
        expect(event.ghostFireCost).toBe(0);
      }
    });
    
    it('🟢 记录打出阴阳术（消耗鬼火）', () => {
      recordPlayCard(history, 'player1', 'inst_002', 'spell_002', '中级符咒', 'spell', 2);
      
      const event = history.events[0];
      if (event.type === 'playCard') {
        expect(event.cardType).toBe('spell');
        expect(event.ghostFireCost).toBe(2);
      }
    });
    
  });
  
  describe('记录使用技能', () => {
    
    it('🟢 记录使用启动技能', () => {
      recordUseSkill(history, 'player1', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      
      expect(history.events).toHaveLength(1);
      const event = history.events[0];
      expect(event.type).toBe('useSkill');
      if (event.type === 'useSkill') {
        expect(event.shikigamiName).toBe('妖刀姬');
        expect(event.skillType).toBe('qi');
        expect(event.ghostFireCost).toBe(1);
      }
    });
    
  });
  
  describe('记录退治妖怪', () => {
    
    it('🟢 记录退治妖怪获得声誉', () => {
      recordDefeatYokai(history, 'player1', 'yokai_038', '三味', 8, 2);
      
      const event = history.events[0];
      expect(event.type).toBe('defeatYokai');
      if (event.type === 'defeatYokai') {
        expect(event.yokaiName).toBe('三味');
        expect(event.yokaiHp).toBe(8);
        expect(event.charmGained).toBe(2);
      }
    });
    
  });
  
  describe('统计打出卡牌', () => {
    
    beforeEach(() => {
      // 设置测试数据：打出3张牌
      recordPlayCard(history, 'player1', 'inst_001', 'yokai_038', '三味', 'yokai', 0);
      recordPlayCard(history, 'player1', 'inst_002', 'spell_001', '基础术式', 'spell', 1);
      recordPlayCard(history, 'player1', 'inst_003', 'spell_002', '中级符咒', 'spell', 2);
    });
    
    it('🟢 统计所有打出的卡牌', () => {
      expect(countCardsPlayed(history)).toBe(3);
      expect(countCardsPlayed(history, 'player1')).toBe(3);
    });
    
    it('🟢 统计打出的阴阳术', () => {
      expect(countSpellsPlayed(history)).toBe(2);
      expect(countSpellsPlayed(history, 'player1')).toBe(2);
    });
    
    it('🟢 统计消耗鬼火的卡牌（三味效果核心）', () => {
      // 三味是0费，两张阴阳术是1费和2费
      expect(countGhostFireCardsPlayed(history)).toBe(2);
    });
    
    it('🟢 获取所有打出卡牌记录', () => {
      const cards = getPlayedCards(history);
      expect(cards).toHaveLength(3);
      expect(cards[0].cardName).toBe('三味');
      expect(cards[1].cardName).toBe('基础术式');
    });
    
  });
  
  describe('统计鬼火消耗', () => {
    
    it('🟢 计算本回合总鬼火消耗', () => {
      recordPlayCard(history, 'player1', 'inst_001', 'spell_001', '基础术式', 'spell', 1);
      recordPlayCard(history, 'player1', 'inst_002', 'spell_002', '中级符咒', 'spell', 2);
      recordUseSkill(history, 'player1', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      
      expect(getTotalGhostFireSpent(history)).toBe(4);
      expect(getTotalGhostFireSpent(history, 'player1')).toBe(4);
    });
    
  });
  
  describe('三味效果模拟', () => {
    
    it('🟢 三味御魂效果：统计本回合鬼火牌', () => {
      // 场景：玩家本回合打出了2张阴阳术（1费+2费），然后打出三味
      recordPlayCard(history, 'player1', 'inst_001', 'spell_001', '基础术式', 'spell', 1);
      recordPlayCard(history, 'player1', 'inst_002', 'spell_002', '中级符咒', 'spell', 2);
      recordPlayCard(history, 'player1', 'inst_003', 'yokai_038', '三味', 'yokai', 0);
      
      // 三味效果计算：鬼火牌数量 * 2
      const ghostFireCards = countGhostFireCardsPlayed(history, 'player1');
      const sammiDamageBonus = ghostFireCards * 2;  // 每张鬼火牌+2伤害
      
      expect(ghostFireCards).toBe(2);  // 两张阴阳术
      expect(sammiDamageBonus).toBe(4);  // +4伤害
    });
    
    it('🟢 三味御魂效果：本回合未打出鬼火牌', () => {
      // 只打出三味，没有其他鬼火牌
      recordPlayCard(history, 'player1', 'inst_001', 'yokai_038', '三味', 'yokai', 0);
      
      const ghostFireCards = countGhostFireCardsPlayed(history, 'player1');
      expect(ghostFireCards).toBe(0);  // 三味本身是0费
    });
    
    it('🟢 三味触发效果：区分主动弃置', () => {
      // 场景：三味被主动弃置（应触发抓牌+3）
      recordDiscardCard(history, 'player1', 'inst_001', '三味', 'manual');
      
      const discards = getDiscardedCards(history, 'player1', 'manual');
      expect(discards).toHaveLength(1);
      expect(discards[0].cardName).toBe('三味');
      expect(discards[0].reason).toBe('manual');
    });
    
    it('🔴 三味触发效果：回合结束弃置不触发', () => {
      // 场景：回合结束清理手牌时弃置（不应触发抓牌效果）
      recordDiscardCard(history, 'player1', 'inst_001', '三味', 'cleanup');
      
      const manualDiscards = getDiscardedCards(history, 'player1', 'manual');
      expect(manualDiscards).toHaveLength(0);  // 主动弃置为空
      
      const cleanupDiscards = getDiscardedCards(history, 'player1', 'cleanup');
      expect(cleanupDiscards).toHaveLength(1);  // 清理弃置有1张
    });
    
  });
  
  describe('检查特定卡牌', () => {
    
    it('🟢 检查是否打出过指定卡牌', () => {
      recordPlayCard(history, 'player1', 'inst_001', 'yokai_038', '三味', 'yokai', 0);
      
      expect(hasPlayedCard(history, '三味')).toBe(true);
      expect(hasPlayedCard(history, '河童')).toBe(false);
    });
    
    it('🟢 检查是否使用过指定式神技能', () => {
      recordUseSkill(history, 'player1', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      
      expect(hasUsedShikigamiSkill(history, '妖刀姬')).toBe(true);
      expect(hasUsedShikigamiSkill(history, '大天狗')).toBe(false);
    });
    
  });
  
  describe('退治妖怪记录', () => {
    
    it('🟢 获取本回合退治的所有妖怪', () => {
      recordDefeatYokai(history, 'player1', 'yokai_001', '唐纸伞妖', 2, 1);
      recordDefeatYokai(history, 'player1', 'yokai_010', '河童', 3, 1);
      
      const defeated = getDefeatedYokai(history);
      expect(defeated).toHaveLength(2);
      expect(defeated[0].yokaiName).toBe('唐纸伞妖');
      expect(defeated[1].yokaiName).toBe('河童');
    });
    
    it('🟢 统计退治妖怪获得的总声誉', () => {
      recordDefeatYokai(history, 'player1', 'yokai_001', '唐纸伞妖', 2, 1);
      recordDefeatYokai(history, 'player1', 'yokai_038', '三味', 8, 2);
      
      const defeated = getDefeatedYokai(history);
      const totalCharm = defeated.reduce((sum, d) => sum + d.charmGained, 0);
      expect(totalCharm).toBe(3);
    });
    
  });
  
  describe('多玩家场景', () => {
    
    it('🟢 区分不同玩家的操作', () => {
      recordPlayCard(history, 'player1', 'inst_001', 'spell_001', '基础术式', 'spell', 1);
      recordPlayCard(history, 'player2', 'inst_002', 'spell_002', '中级符咒', 'spell', 2);
      
      expect(countCardsPlayed(history, 'player1')).toBe(1);
      expect(countCardsPlayed(history, 'player2')).toBe(1);
      expect(countCardsPlayed(history)).toBe(2);  // 总数
    });
    
    it('🟢 不传玩家ID时统计所有玩家', () => {
      recordPlayCard(history, 'player1', 'inst_001', 'spell_001', '基础术式', 'spell', 1);
      recordPlayCard(history, 'player2', 'inst_002', 'spell_002', '中级符咒', 'spell', 2);
      recordUseSkill(history, 'player3', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      
      expect(getTotalGhostFireSpent(history)).toBe(4);
    });
    
  });
  
  describe('技能使用统计', () => {
    
    it('🟢 统计使用技能次数', () => {
      recordUseSkill(history, 'player1', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      recordUseSkill(history, 'player1', 'shikigami_002', '大天狗', '神威', 'qi', 2);
      
      expect(countSkillsUsed(history)).toBe(2);
      expect(countSkillsUsed(history, 'player1', 'qi')).toBe(2);
    });
    
    it('🟢 按技能类型筛选', () => {
      recordUseSkill(history, 'player1', 'shikigami_001', '妖刀姬', '居合', 'qi', 1);
      recordUseSkill(history, 'player1', 'shikigami_003', '荒', '鬼灭之阵', 'yong', 0);
      
      expect(countSkillsUsed(history, undefined, 'qi')).toBe(1);
      expect(countSkillsUsed(history, undefined, 'yong')).toBe(1);
    });
    
  });
  
});
