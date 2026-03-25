import { describe, it, expect, vi, afterEach } from 'vitest';
import { MultiplayerGame } from '../MultiplayerGame';

function createGame(playerCount = 3): MultiplayerGame {
  const players = Array.from({ length: playerCount }).map((_, i) => ({
    id: `p${i + 1}`,
    name: `玩家${i + 1}`,
  }));
  const game = new MultiplayerGame('test-room', players);
  const state: any = (game as any).state;
  state.phase = 'playing';
  state.turnPhase = 'action';
  state.currentPlayerIndex = 0;
  return game;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('多人计时与托管回归', () => {
  it('按真人玩家数量映射回合超时时间', () => {
    const game = createGame(6) as any;
    const state = game.state;

    // 1 真人 + 5 AI => 无限
    state.players.forEach((p: any, i: number) => { p.isAI = i !== 0; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(0);

    // 2 真人 => 30 秒
    state.players.forEach((p: any, i: number) => { p.isAI = i > 1; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(30000);

    // 3 真人 => 25 秒
    state.players.forEach((p: any, i: number) => { p.isAI = i > 2; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(25000);

    // 4 真人 => 20 秒
    state.players.forEach((p: any, i: number) => { p.isAI = i > 3; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(20000);

    // 5/6 真人 => 15 秒
    state.players.forEach((p: any, i: number) => { p.isAI = i > 4; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(15000);
    state.players.forEach((p: any) => { p.isAI = false; });
    expect(game.getTurnTimeoutMsByHumanCount()).toBe(15000);
  });

  it('回合超时时会先收口 pendingChoice 再自动结束回合', () => {
    const game = createGame(3) as any;
    const curId = game.state.players[0].id;
    let salvageCalled = false;
    let endTurnCalled = false;

    game.state.pendingChoice = {
      type: 'salvageChoice',
      playerId: curId,
      prompt: '是否超度',
      options: ['是', '否'],
    };

    game.handleSalvageResponse = () => {
      salvageCalled = true;
      game.state.pendingChoice = undefined;
      return { success: true };
    };
    game.handleEndTurn = () => {
      endTurnCalled = true;
      return { success: true };
    };

    game.handleTurnTimeout(curId);

    expect(salvageCalled).toBe(true);
    expect(endTurnCalled).toBe(true);
    expect(game.state.pendingChoice).toBeUndefined();
  });

  it('AFK 超时会触发强制退出回调', () => {
    const game = createGame(3) as any;
    const curId = game.state.players[0].id;
    const forceExit = vi.fn();
    game.setOnForceExit(forceExit);

    game.state.players[0].isConnected = true;
    game.state.players[0].isAI = false;
    game.state.players[0].lastActionAt = Date.now() - 300001;

    game.checkInactivityKick();
    expect(forceExit).toHaveBeenCalledWith(curId, 'afk');
  });

  it('掉线未重连超过保护时间会触发退出', () => {
    vi.useFakeTimers();
    const game = createGame(3);
    const state: any = (game as any).state;
    const curId = state.players[0].id;
    const forceExit = vi.fn();
    game.setOnForceExit(forceExit);

    game.onPlayerDisconnected(curId);
    expect(state.players[0].isOfflineHosted).toBe(true);

    vi.advanceTimersByTime(180600);
    expect(forceExit).toHaveBeenCalledWith(curId, 'disconnect_timeout');
  });

  it('保护期内重连会恢复控制且不触发退出', () => {
    vi.useFakeTimers();
    const game = createGame(3);
    const state: any = (game as any).state;
    const curId = state.players[0].id;
    const forceExit = vi.fn();
    game.setOnForceExit(forceExit);

    game.onPlayerDisconnected(curId);
    game.onPlayerReconnected(curId);

    expect(state.players[0].isConnected).toBe(true);
    expect(state.players[0].isOfflineHosted).toBe(false);

    vi.advanceTimersByTime(181000);
    expect(forceExit).not.toHaveBeenCalled();
  });
});
