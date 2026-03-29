/**
 * 进程内 Socket.io 烟囱：不覆盖业务协议矩阵，仅验证连接/广播/往返。
 */
import { describe, it, expect } from 'vitest';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

/** 使用独立端口监听，避免 Vitest 下「HTTP 已 listen 但与 Engine 绑定时序」导致的 Server is not running */
async function withSocketServer(
  fn: (port: number, io: Server) => Promise<void>
): Promise<void> {
  const io = new Server(0, { cors: { origin: '*' } });
  await new Promise<void>((resolve, reject) => {
    io.httpServer.once('error', reject);
    io.httpServer.once('listening', () => resolve());
  });
  const addr = io.httpServer.address() as AddressInfo;
  const port = addr.port;
  try {
    await fn(port, io);
  } finally {
    await new Promise<void>(res => io.close(() => res()));
  }
}

describe('socket.io 烟囱', () => {
  it('连接后收到服务端 hello', async () => {
    await withSocketServer(async (port, io) => {
      io.on('connection', s => {
        s.emit('hello', { ok: true });
      });
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      const payload = await new Promise<unknown>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 5000);
        client.once('hello', (p: unknown) => {
          clearTimeout(t);
          resolve(p);
        });
      });
      expect(payload).toEqual({ ok: true });
      client.close();
    });
  });

  it('客户端 emit 服务端可 ack', async () => {
    await withSocketServer(async (port, io) => {
      io.on('connection', s => {
        s.on('ping', (x: number, cb: (y: number) => void) => {
          cb(x + 1);
        });
      });
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      const out = await new Promise<number>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 5000);
        client.emit('ping', 41, (y: number) => {
          clearTimeout(t);
          resolve(y);
        });
      });
      expect(out).toBe(42);
      client.close();
    });
  });

  it('room 广播仅房间内可见', async () => {
    await withSocketServer(async (port, io) => {
      const room = 'r1';
      io.on('connection', s => {
        s.on('joinRoom', (r: string) => {
          void s.join(r);
        });
        s.on('broadcast', (r: string) => {
          io.to(r).emit('roomMsg', { room: r });
        });
      });
      const inside: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      const outside: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      await new Promise<void>(resolve => inside.once('connect', () => resolve()));
      await new Promise<void>(resolve => outside.once('connect', () => resolve()));

      inside.emit('joinRoom', room);

      const gotInside = new Promise<unknown>(resolve => {
        inside.once('roomMsg', resolve);
      });
      let outsideGot = false;
      outside.once('roomMsg', () => {
        outsideGot = true;
      });

      inside.emit('broadcast', room);
      const msg = await gotInside;
      expect(msg).toEqual({ room });
      await new Promise(r => setTimeout(r, 150));
      expect(outsideGot).toBe(false);
      inside.close();
      outside.close();
    });
  });

  it('断开后不再收到事件', async () => {
    await withSocketServer(async (port, io) => {
      io.on('connection', s => {
        const id = s.id;
        const iv = setInterval(() => {
          io.to(id).emit('tick', Date.now());
        }, 25);
        s.on('disconnect', () => clearInterval(iv));
      });
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      let tickCount = 0;
      await new Promise<void>(resolve => {
        client.on('tick', () => {
          tickCount++;
          if (tickCount >= 2) resolve();
        });
      });
      client.close();
      await new Promise(r => setTimeout(r, 120));
      const c = tickCount;
      await new Promise(r => setTimeout(r, 80));
      expect(tickCount).toBe(c);
    });
  });
});
