/**
 * 妖怪卡关键词：与 cards.json 的 subtype 字段对齐，写入 CardInstance.keywords。
 */

import type { CardInstance } from '../types/cards';

export function parseSubtypeToKeywords(subtype: string | undefined): string[] {
  if (!subtype?.trim()) return [];
  return subtype
    .split(/[/，,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** 显式 keywords 非空时优先，否则由 subtype 解析 */
export function resolveYokaiKeywords(card: { subtype?: string; keywords?: string[] }): string[] {
  if (card.keywords && card.keywords.length > 0) {
    return [...card.keywords];
  }
  return parseSubtypeToKeywords(card.subtype);
}

/** 策划定义：『鬼火』牌仅指 yokai 且 keywords 含该串；阴阳术单独统计。 */
export function cardHasKeyword(
  card: Pick<CardInstance, 'cardType' | 'keywords'> & { subtype?: string },
  keyword: string,
): boolean {
  if (card.cardType !== 'yokai') return false;
  return resolveYokaiKeywords({
    subtype: card.subtype,
    keywords: card.keywords,
  }).includes(keyword);
}
