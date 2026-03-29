/**
 * 三味：计入本回合已打出的「鬼火」御魂以 CardInstance.keywords 为准（与 subtype 解析一致）。
 */
import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  createYokaiTestCard,
  createSpellInstance,
} from './multiplayerTestHarness';
import type { MultiplayerGame } from '../MultiplayerGame';

describe('三味 × 鬼火 keywords', () => {
  it('played 含薙魂（御魂/鬼火）时打出三味伤害 +2；仅御魂无鬼火不计', () => {
    const game: MultiplayerGame = createMultiplayerGameForTest({ playerCount: 2 });
    const player = getHarnessPlayer(game, 0);
    const nagi = createYokaiTestCard('薙魂', 4, {
      cardId: 'yokai_022',
      keywords: ['御魂', '鬼火'],
    });
    const soldier = createYokaiTestCard('兵主部', 3, {
      cardId: 'yokai_014',
      keywords: ['御魂'],
    });

    (player as any).played = [nagi, soldier];
    player.damage = 0;
    const sanmi = createYokaiTestCard('三味', 8, { cardId: 'yokai_038', keywords: ['御魂'] });
    (game as any).executeYokaiEffect(player, sanmi, 1);
    expect(player.damage).toBe(2);
  });

  it('played 含阴阳术与鬼火御魂时按张数累加', () => {
    const game: MultiplayerGame = createMultiplayerGameForTest({ playerCount: 2 });
    const player = getHarnessPlayer(game, 0);
    const lantern = createYokaiTestCard('灯笼鬼', 3, {
      cardId: 'yokai_008',
      keywords: ['御魂', '鬼火'],
    });
    const spell = createSpellInstance('基础术式', 2, 'spell_test_1');
    (player as any).played = [lantern, spell];
    player.damage = 0;
    const sanmi = createYokaiTestCard('三味', 8, { cardId: 'yokai_038', keywords: ['御魂'] });
    (game as any).executeYokaiEffect(player, sanmi, 1);
    expect(player.damage).toBe(4);
  });
});
