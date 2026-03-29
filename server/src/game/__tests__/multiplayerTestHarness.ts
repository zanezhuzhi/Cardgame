/**
 * MultiplayerGame 集成测试 harness：统一走 handleAction / 公开响应 API。
 */
import { MultiplayerGame } from '../MultiplayerGame';
import type { CardInstance, PlayerState } from '../../types';

export type HarnessPlayerSpec = { id?: string; name?: string };

export interface CreateMultiplayerGameForTestOptions {
  playerCount?: number;
  players?: HarnessPlayerSpec[];
  roomId?: string;
  /** 构造后强制进入对局阶段（默认 playing） */
  phase?: 'playing' | 'waiting' | 'setup' | 'shikigamiSelect' | 'ended';
  turnPhase?: 'ghostFire' | 'shikigami' | 'action' | 'cleanup';
  currentPlayerIndex?: number;
}

export function createMultiplayerGameForTest(opts: CreateMultiplayerGameForTestOptions = {}): MultiplayerGame {
  const playerCount = opts.players?.length ?? opts.playerCount ?? 2;
  const players = opts.players?.length
    ? opts.players.map((p, i) => ({
        id: p.id ?? `p${i + 1}`,
        name: p.name ?? `玩家${i + 1}`,
      }))
    : Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i + 1}`,
        name: `玩家${i + 1}`,
      }));

  const game = new MultiplayerGame(opts.roomId ?? 'test-room', players);
  const state = (game as any).state;

  state.phase = opts.phase ?? 'playing';
  state.turnPhase = opts.turnPhase ?? 'action';
  state.currentPlayerIndex = opts.currentPlayerIndex ?? 0;

  return game;
}

export function getHarnessState(game: MultiplayerGame): any {
  return (game as any).state;
}

export function getHarnessPlayer(game: MultiplayerGame, index = 0): PlayerState {
  return (game as any).state.players[index];
}

export function actionPlayCard(
  game: MultiplayerGame,
  playerId: string,
  cardInstanceId: string
): { success: boolean; error?: string } {
  return game.handleAction(playerId, { type: 'playCard', cardInstanceId });
}

export function actionEndTurn(game: MultiplayerGame, playerId: string): { success: boolean; error?: string } {
  return game.handleAction(playerId, { type: 'endTurn' });
}

/** 测试用小写 action，与客户端一致 */
export function createSpellInstance(name: string, damage: number, instanceId: string): CardInstance {
  return {
    instanceId,
    cardId: `spell_${name}`,
    cardType: 'spell',
    name,
    hp: damage,
    maxHp: damage,
    damage,
  };
}

export function createYokaiTestCard(
  name: string,
  hp: number,
  overrides: Partial<CardInstance> = {}
): CardInstance {
  return {
    instanceId: `yokai_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    cardId: `yokai_test_${name}`,
    cardType: 'yokai',
    name,
    hp,
    maxHp: hp,
    damage: 0,
    ...overrides,
  };
}
