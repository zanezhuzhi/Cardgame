import { describe, it, expect } from 'vitest';
import {
  parseSubtypeToKeywords,
  resolveYokaiKeywords,
  cardHasKeyword,
} from './cardKeywords';
import type { CardInstance } from '../types/cards';

describe('cardKeywords', () => {
  it('parseSubtypeToKeywords 按 / 与全角逗号拆分', () => {
    expect(parseSubtypeToKeywords('御魂/鬼火')).toEqual(['御魂', '鬼火']);
    expect(parseSubtypeToKeywords('御魂，妨害')).toEqual(['御魂', '妨害']);
    expect(parseSubtypeToKeywords(undefined)).toEqual([]);
    expect(parseSubtypeToKeywords('  ')).toEqual([]);
  });

  it('resolveYokaiKeywords 显式 keywords 优先', () => {
    expect(
      resolveYokaiKeywords({ subtype: '御魂', keywords: ['御魂', '鬼火'] }),
    ).toEqual(['御魂', '鬼火']);
    expect(resolveYokaiKeywords({ subtype: '御魂/鬼火' })).toEqual(['御魂', '鬼火']);
    expect(resolveYokaiKeywords({ subtype: '御魂' })).toEqual(['御魂']);
  });

  it('cardHasKeyword 仅 yokai 且含关键词（显式 keywords 或 subtype）', () => {
    const y: Pick<CardInstance, 'cardType' | 'keywords'> = {
      cardType: 'yokai',
      keywords: ['御魂', '鬼火'],
    };
    expect(cardHasKeyword(y, '鬼火')).toBe(true);
    expect(cardHasKeyword(y, '妨害')).toBe(false);

    const fromSubtype: Pick<CardInstance, 'cardType' | 'keywords' | 'subtype'> = {
      cardType: 'yokai',
      keywords: [],
      subtype: '御魂/妨害',
    };
    expect(cardHasKeyword(fromSubtype, '妨害')).toBe(true);

    const s: Pick<CardInstance, 'cardType' | 'keywords'> = {
      cardType: 'spell',
      keywords: ['鬼火'],
    };
    expect(cardHasKeyword(s, '鬼火')).toBe(false);
  });
});
