/**
 * 日志实体引用提取测试
 * 验证 extractEntityRefs 和 addLog 的正确性
 */
import { describe, it, expect, beforeEach } from 'vitest'
import cardsData from '../../../../shared/data/cards.json'

// 模拟 extractEntityRefs 逻辑（从 MultiplayerGame 中提取的核心逻辑）
function extractEntityRefs(message: string): Record<string, { type: 'card' | 'shikigami' | 'boss' | 'player'; id: string; name: string; data?: any }> {
  const refs: Record<string, { type: 'card' | 'shikigami' | 'boss' | 'player'; id: string; name: string; data?: any }> = {};
  let refIndex = 0;
  
  const allYokai = (cardsData as any).yokai || [];
  const allBoss = (cardsData as any).boss || [];
  const allShikigami = (cardsData as any).shikigami || [];
  const allSpells = ['基础术式', '中级符咒', '高级符咒'];
  
  // 检查妖怪
  for (const yokai of allYokai) {
    if (message.includes(yokai.name)) {
      const key = `yokai_${refIndex++}`;
      refs[key] = {
        type: 'card',
        id: yokai.id || yokai.cardId,
        name: yokai.name,
        data: { hp: yokai.hp, damage: yokai.damage, charm: yokai.charm, image: yokai.image, effect: yokai.effect }
      };
    }
  }
  
  // 检查鬼王
  for (const boss of allBoss) {
    if (message.includes(boss.name)) {
      const key = `boss_${refIndex++}`;
      refs[key] = {
        type: 'boss',
        id: boss.id || boss.cardId,
        name: boss.name,
        data: { hp: boss.hp, charm: boss.charm, image: boss.image, effect: boss.effect }
      };
    }
  }
  
  // 检查式神
  for (const shikigami of allShikigami) {
    if (message.includes(shikigami.name)) {
      const key = `shikigami_${refIndex++}`;
      refs[key] = {
        type: 'shikigami',
        id: shikigami.id || shikigami.cardId,
        name: shikigami.name,
        data: { hp: shikigami.hp, charm: shikigami.charm, image: shikigami.image, skill: shikigami.skill, skillCost: shikigami.skillCost }
      };
    }
  }
  
  // 检查阴阳术
  for (const spellName of allSpells) {
    if (message.includes(spellName)) {
      const key = `spell_${refIndex++}`;
      const spellData = spellName === '基础术式' 
        ? { damage: 1, hp: 1, charm: 0, image: '阴阳术01.png' }
        : spellName === '中级符咒'
        ? { damage: 2, hp: 2, charm: 0, image: '阴阳术02.png' }
        : { damage: 3, hp: 3, charm: 1, image: '阴阳术03.png' };
      refs[key] = {
        type: 'card',
        id: `spell_${spellName}`,
        name: spellName,
        data: spellData
      };
    }
  }
  
  return refs;
}

// 模拟转义正则
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 模拟 addLog 的消息处理逻辑
function processLogMessage(message: string, refs: Record<string, any>): string {
  let processedMessage = message;
  for (const [key, ref] of Object.entries(refs)) {
    const name = ref.name;
    if (!processedMessage.includes(`{${key}}`)) {
      // 使用正则避免重复替换
      processedMessage = processedMessage.replace(
        new RegExp(`(?<!\\{[^}]*)${escapeRegex(name)}(?![^{]*\\})`, 'g'),
        `{${key}}`
      );
    }
  }
  return processedMessage;
}

// 模拟客户端 getLogRefCardImage 逻辑
function getLogRefCardImage(ref: any): string {
  if (!ref) return ''
  
  const rawId = ref.id
  if (!rawId) return ''
  
  const m = String(rawId).match(/^(\w+)_(\d+)$/)
  if (!m) {
    if (rawId.startsWith('spell_')) {
      const spellName = rawId.replace('spell_', '')
      if (spellName === '基础术式') return '/images/spells/601.webp'
      if (spellName === '中级符咒') return '/images/spells/602.webp'
      if (spellName === '高级符咒') return '/images/spells/603.webp'
    }
    return ''
  }
  
  const [, type, num] = m
  const n = parseInt(num)
  
  if (type === 'yokai')     return `/images/yokai/${201 + n}.webp`
  if (type === 'boss')      return `/images/bosses/${100 + n}.webp`
  if (type === 'shikigami') return `/images/shikigami/${400 + n}.webp`
  if (type === 'spell')     return `/images/spells/${600 + n}.webp`
  
  return ''
}

describe('日志实体引用提取', () => {
  
  describe('extractEntityRefs - 提取妖怪', () => {
    it('应该从消息中提取天邪鬼绿', () => {
      const message = '退治了天邪鬼绿'
      const refs = extractEntityRefs(message)
      
      console.log('天邪鬼绿 refs:', JSON.stringify(refs, null, 2))
      
      expect(Object.keys(refs).length).toBeGreaterThan(0)
      const yokaiRef = Object.values(refs).find(r => r.name === '天邪鬼绿')
      expect(yokaiRef).toBeDefined()
      expect(yokaiRef?.id).toBe('yokai_003') // 验证id格式
    })
    
    it('应该从消息中提取轮入道', () => {
      const message = '退治了轮入道'
      const refs = extractEntityRefs(message)
      
      console.log('轮入道 refs:', JSON.stringify(refs, null, 2))
      
      const yokaiRef = Object.values(refs).find(r => r.name === '轮入道')
      expect(yokaiRef).toBeDefined()
      expect(yokaiRef?.id).toMatch(/^yokai_\d+$/)
    })
  })
  
  describe('extractEntityRefs - 提取阴阳术', () => {
    it('应该从消息中提取基础术式', () => {
      const message = '打出基础术式'
      const refs = extractEntityRefs(message)
      
      console.log('基础术式 refs:', JSON.stringify(refs, null, 2))
      
      expect(Object.keys(refs).length).toBeGreaterThan(0)
      const spellRef = Object.values(refs).find(r => r.name === '基础术式')
      expect(spellRef).toBeDefined()
      expect(spellRef?.id).toBe('spell_基础术式')
    })
    
    it('应该从消息中提取中级符咒', () => {
      const message = '打出中级符咒'
      const refs = extractEntityRefs(message)
      
      const spellRef = Object.values(refs).find(r => r.name === '中级符咒')
      expect(spellRef).toBeDefined()
      expect(spellRef?.id).toBe('spell_中级符咒')
    })
  })
  
  describe('extractEntityRefs - 提取鬼王', () => {
    it('应该从消息中提取麒麟', () => {
      const message = '鬼王麒麟登场'
      const refs = extractEntityRefs(message)
      
      console.log('麒麟 refs:', JSON.stringify(refs, null, 2))
      
      const bossRef = Object.values(refs).find(r => r.name === '麒麟')
      expect(bossRef).toBeDefined()
      expect(bossRef?.id).toMatch(/^boss_\d+$/)
    })
  })
  
  describe('processLogMessage - 占位符替换', () => {
    it('应该将基础术式替换为占位符', () => {
      const message = '打出基础术式(+1伤害)'
      const refs = extractEntityRefs(message)
      const processed = processLogMessage(message, refs)
      
      console.log('原消息:', message)
      console.log('处理后:', processed)
      console.log('refs:', JSON.stringify(refs, null, 2))
      
      // 应该包含占位符
      expect(processed).toContain('{spell_')
      expect(processed).not.toContain('基础术式')
    })
    
    it('应该将天邪鬼绿替换为占位符', () => {
      const message = '退治了天邪鬼绿(+0声誉)'
      const refs = extractEntityRefs(message)
      const processed = processLogMessage(message, refs)
      
      console.log('原消息:', message)
      console.log('处理后:', processed)
      
      expect(processed).toContain('{yokai_')
      expect(processed).not.toContain('天邪鬼绿')
    })
  })
  
  describe('getLogRefCardImage - 图片路径计算', () => {
    it('yokai_003 应该返回 /images/yokai/204.webp', () => {
      const ref = { id: 'yokai_003', name: '天邪鬼绿', type: 'card' }
      const path = getLogRefCardImage(ref)
      
      console.log('yokai_003 图片路径:', path)
      
      expect(path).toBe('/images/yokai/204.webp')
    })
    
    it('yokai_001 应该返回 /images/yokai/202.webp', () => {
      const ref = { id: 'yokai_001', name: '赤舌', type: 'card' }
      const path = getLogRefCardImage(ref)
      
      expect(path).toBe('/images/yokai/202.webp')
    })
    
    it('spell_基础术式 应该返回 /images/spells/601.webp', () => {
      const ref = { id: 'spell_基础术式', name: '基础术式', type: 'card' }
      const path = getLogRefCardImage(ref)
      
      console.log('基础术式 图片路径:', path)
      
      expect(path).toBe('/images/spells/601.webp')
    })
    
    it('boss_001 应该返回 /images/bosses/101.webp', () => {
      const ref = { id: 'boss_001', name: '酒吞童子', type: 'boss' }
      const path = getLogRefCardImage(ref)
      
      expect(path).toBe('/images/bosses/101.webp')
    })
  })
  
  describe('完整流程测试', () => {
    it('打出基础术式的完整流程', () => {
      const originalMessage = '🎴 1 打出基础术式(+1伤害)'
      
      // 步骤1: 提取refs
      const refs = extractEntityRefs(originalMessage)
      console.log('步骤1 - 提取refs:', JSON.stringify(refs, null, 2))
      
      // 步骤2: 替换消息
      const processedMessage = processLogMessage(originalMessage, refs)
      console.log('步骤2 - 处理后消息:', processedMessage)
      
      // 步骤3: 验证图片路径
      const spellRef = Object.values(refs).find(r => r.name === '基础术式')
      if (spellRef) {
        const imagePath = getLogRefCardImage(spellRef)
        console.log('步骤3 - 图片路径:', imagePath)
        expect(imagePath).toBe('/images/spells/601.webp')
      }
      
      // 验证
      expect(Object.keys(refs).length).toBeGreaterThan(0)
      expect(processedMessage).toContain('{spell_')
    })
  })
})
