<template>
  <div class="dev-test-root">
    <button
      v-if="!expanded"
      type="button"
      class="dev-tab"
      title="开发测试面板 (?devPanel=1)"
      @click="expanded = true"
    >
      DEV
    </button>
    <div v-else class="dev-panel">
      <div class="dev-panel-head">
        <span class="dev-title">测试面板</span>
        <button type="button" class="dev-btn-icon" title="收起" @click="expanded = false">−</button>
      </div>

      <div class="dev-section">
        <div class="dev-kv"><span>连接</span><b :class="connClass">{{ connLabel }}</b></div>
        <div class="dev-kv"><span>延迟</span><b>{{ latencyMs }} ms</b></div>
        <div class="dev-kv"><span>服务端 URL</span>
          <code class="dev-code dev-code-wide" @click="copy(serverUrl)" :title="serverUrl">{{ serverUrlShort }}</code>
        </div>
        <div class="dev-kv"><span>模式</span><b>{{ isMultiMode ? '多人' : '单人' }}</b></div>
        <div class="dev-kv"><span>路由 devPanel</span><b>{{ route.query.devPanel ?? '—' }}</b></div>
        <div class="dev-kv"><span>房间码</span>
          <code class="dev-code" @click="copy(roomId || '—')">{{ roomId || '—' }}</code>
        </div>
        <div class="dev-kv"><span>本机 socketId</span>
          <code class="dev-code" @click="copy(playerId || '—')">{{ shortId(playerId) }}</code>
        </div>
      </div>

      <div class="dev-section" v-if="roomDetail">
        <div class="dev-section-title">Room（大厅同步）</div>
        <div class="dev-kv"><span>status</span><b>{{ roomDetail.status }}</b></div>
        <div class="dev-kv"><span>hostId</span>
          <code class="dev-code" @click="copy(roomDetail.hostId)">{{ shortId(roomDetail.hostId) }}</code>
        </div>
        <div class="dev-kv"><span>人数</span><b>{{ roomDetail.players?.length ?? 0 }} / {{ roomDetail.maxPlayers }}</b></div>
        <div class="dev-pre-block" @click="copy(roomPlayersLines)">{{ roomPlayersLines }}</div>
      </div>

      <div class="dev-section" v-if="gs">
        <div class="dev-section-title">GameState（与 bug 查验对齐）</div>
        <div class="dev-kv"><span>state.roomId</span>
          <code class="dev-code" @click="copy(String(gs.roomId ?? ''))">{{ gs.roomId || '—' }}</code>
        </div>
        <div class="dev-kv"><span>phase</span><b>{{ gs.phase }}</b></div>
        <div class="dev-kv"><span>turnPhase</span><b>{{ gs.turnPhase }}</b></div>
        <div class="dev-kv"><span>turnNumber</span><b>{{ gs.turnNumber }}</b></div>
        <div class="dev-kv"><span>currentPlayerIndex</span><b>{{ gs.currentPlayerIndex }} {{ currentPlayerHint }}</b></div>
        <div class="dev-kv"><span>playerCount</span><b>{{ gs.playerCount ?? '—' }} · 座席 {{ gs.players?.length ?? 0 }}</b></div>
        <div class="dev-kv"><span>真人座（!isAI）</span><b>{{ humanSeatCount }}</b></div>
        <div class="dev-kv"><span>turnTimeoutMs</span><b>{{ fmtNum(gs.turnTimeoutMs) }}</b></div>
        <div class="dev-kv"><span>turnStartAt</span><b class="dev-mono-sm">{{ fmtTs(gs.turnStartAt) }}</b></div>
        <div class="dev-kv"><span>行动阶段剩余</span><b>{{ turnTimerLabel }}</b></div>
        <div class="dev-kv"><span>lastUpdate</span><b class="dev-mono-sm">{{ fmtTs(gs.lastUpdate) }}</b></div>
        <div class="dev-kv"><span>lastPlayerKilledYokai</span><b>{{ fmtBool(gs.lastPlayerKilledYokai) }}</b></div>
        <div class="dev-kv"><span>pendingYokaiRefresh</span><b>{{ fmtBool(gs.pendingYokaiRefresh) }}</b></div>
        <div class="dev-kv"><span>turnHadKill</span><b>{{ fmtBool(gs.turnHadKill) }}</b></div>
        <div class="dev-kv"><span>shikigamiSelectTimeout</span><b>{{ fmtNum(gs.shikigamiSelectTimeout) }}</b></div>
        <div class="dev-kv"><span>shikigamiSelectStartTime</span><b class="dev-mono-sm">{{ fmtTs(gs.shikigamiSelectStartTime) }}</b></div>

        <div class="dev-subtitle">pendingChoice</div>
        <pre v-if="pendingChoiceJson" class="dev-pre" @click="copy(pendingChoiceJson)">{{ pendingChoiceJson }}</pre>
        <div v-else class="dev-muted-inline">（无）</div>

        <div class="dev-subtitle">players[]</div>
        <div class="dev-player-grid">
          <div v-for="row in playerDebugRows" :key="row.id" class="dev-player-card" :class="{ me: row.isMe, offline: !row.isConnected }">
            <div class="dev-player-head">
              <span class="dev-p-idx">#{{ row.idx }}</span>
              <span class="dev-p-name">{{ row.name }}</span>
              <span v-if="row.isMe" class="dev-p-badge">我</span>
              <span v-if="!row.isConnected" class="dev-p-badge offline">离线</span>
              <span v-if="row.isOfflineHosted" class="dev-p-badge hosted">托管</span>
              <span v-if="row.isAI" class="dev-p-badge ai">AI</span>
            </div>
            <div class="dev-p-rows">
              <div>🔥{{ row.ghostFire }} ⚔️{{ row.damage }} 🃏{{ row.handN }}/{{ row.deckN }}/{{ row.discardN }}</div>
              <div v-if="row.lastActionAgo">操作 {{ row.lastActionAgo }}</div>
            </div>
          </div>
        </div>

        <button type="button" class="dev-copy-json" @click="copyDiagnosticJson">复制完整诊断 JSON</button>
      </div>
      <div v-else class="dev-section dev-muted">暂无 gameState（未开局或未同步）</div>

      <div class="dev-section dev-actions">
        <span class="dev-actions-label">GM</span>
        <div class="dev-btn-row">
          <button type="button" class="dev-cmd" :disabled="!canGm" @click="run('/timeout')">超时回合</button>
          <button type="button" class="dev-cmd" :disabled="!canGm" @click="run('/offline')">模拟掉线</button>
          <button type="button" class="dev-cmd" :disabled="!canGm" @click="run('/online')">恢复在线</button>
          <button type="button" class="dev-cmd" :disabled="!canGm" @click="run('/afk 301')">AFK 判退</button>
        </div>
        <div class="dev-btn-row">
          <button type="button" class="dev-cmd dev-cmd-sm" :disabled="!canGm" @click="run('/ping')">ping</button>
          <button type="button" class="dev-cmd dev-cmd-sm" :disabled="!canGm" @click="run('/status')">status</button>
          <button type="button" class="dev-cmd dev-cmd-sm" :disabled="!canGm" @click="run('/help')">help</button>
        </div>
      </div>

      <div v-if="lastMsg" class="dev-last" :class="{ err: lastErr }">{{ lastMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { socketClient } from '../network/SocketClient'

const route = useRoute()
const expanded = ref(true)

const isMultiMode = computed(() => route.query.mode === 'multi')

const playerId = computed(() => socketClient.playerId.value)
const roomId = computed(() => socketClient.currentRoom.value?.id ?? '')
const latencyMs = computed(() => socketClient.latency.value)
const status = computed(() => socketClient.status.value)

const gs = computed(() => socketClient.gameState.value as any)

function tickNow() {
  return Date.now()
}

const nowTick = ref(tickNow())
let devPanelTickTimer: ReturnType<typeof setInterval> | null = null
devPanelTickTimer = setInterval(() => {
  nowTick.value = tickNow()
}, 500)

onUnmounted(() => {
  if (devPanelTickTimer) clearInterval(devPanelTickTimer)
})

const serverUrl = String(import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3002')
const serverUrlShort = computed(() =>
  serverUrl.length > 36 ? `${serverUrl.slice(0, 20)}…${serverUrl.slice(-10)}` : serverUrl
)

const roomDetail = computed(() => socketClient.currentRoom.value)

const roomPlayersLines = computed(() => {
  const r = roomDetail.value
  if (!r?.players?.length) return '（无房间成员）'
  return r.players
    .map(
      (p: any) =>
        `${p.name} | id=${p.id} | host=${!!p.isHost} | conn=${p.isConnected} | ready=${p.isReady}`
    )
    .join('\n')
})

const connLabel = computed(() => {
  switch (status.value) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中…'
    case 'reconnecting': return '重连中…'
    default: return '未连接'
  }
})

const connClass = computed(() => ({
  ok: status.value === 'connected',
  warn: status.value === 'connecting' || status.value === 'reconnecting',
  bad: status.value === 'disconnected',
}))

const humanSeatCount = computed(() => {
  const players = gs.value?.players
  if (!Array.isArray(players)) return '—'
  return String(players.filter((p: any) => !p?.isAI).length)
})

const currentPlayerHint = computed(() => {
  const list = gs.value?.players
  const i = gs.value?.currentPlayerIndex
  if (!Array.isArray(list) || i === undefined) return ''
  const p = list[i]
  return p ? `「${p.name}」` : ''
})

function fmtNum(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  return String(v)
}

function fmtBool(v: unknown): string {
  if (v === undefined) return '—'
  return String(!!v)
}

function fmtTs(t: unknown): string {
  const n = Number(t)
  if (!n) return '—'
  return `${n} | ${new Date(n).toLocaleString()}`
}

function fmtTsAndAgo(t: unknown, now: number): string {
  const n = Number(t)
  if (!n) return '—'
  const sec = Math.floor((now - n) / 1000)
  return `${n} (${sec}s ago)`
}

function shortId(id: string) {
  if (!id || id === '—') return '—'
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

const turnTimerLabel = computed(() => {
  const s = gs.value
  if (!s || s.phase !== 'playing' || s.turnPhase !== 'action') return '—'
  const ms = Number(s.turnTimeoutMs) || 0
  if (ms <= 0) return '∞'
  const start = Number(s.turnStartAt) || 0
  if (!start) return `${Math.round(ms / 1000)}s`
  const left = Math.max(0, ms - (nowTick.value - start))
  return `${Math.ceil(left / 1000)}s / ${Math.round(ms / 1000)}s`
})

const pendingChoiceJson = computed(() => {
  const pc = gs.value?.pendingChoice
  if (!pc) return ''
  try {
    return JSON.stringify(pc, null, 2)
  } catch {
    return String(pc)
  }
})

const playerDebugRows = computed(() => {
  const players = gs.value?.players
  if (!Array.isArray(players)) return []
  const now = nowTick.value
  return players.map((p: any, idx: number) => ({
    idx,
    id: p.id as string,
    name: p.name ?? '—',
    isMe: p.id === playerId.value,
    isAI: !!p.isAI,
    isConnected: p.isConnected !== false,
    isOfflineHosted: !!p.isOfflineHosted,
    lastActionAgo: fmtAgoShort(p.lastActionAt, now),
    ghostFire: p.ghostFire ?? 0,
    damage: p.damage ?? 0,
    handN: p.hand?.length ?? 0,
    deckN: p.deck?.length ?? 0,
    discardN: p.discard?.length ?? 0,
  }))
})

// 简洁的相对时间格式（如 "5s前"、"2m前"）
function fmtAgoShort(ts: number | undefined, now: number): string {
  if (!ts) return ''
  const diff = Math.floor((now - ts) / 1000)
  if (diff < 0) return ''
  if (diff < 60) return `${diff}s前`
  if (diff < 3600) return `${Math.floor(diff / 60)}m前`
  return `${Math.floor(diff / 3600)}h前`
}

const canGm = computed(() => !!roomId.value && status.value === 'connected')

const lastMsg = ref('')
const lastErr = ref(false)

async function run(cmd: string) {
  lastErr.value = false
  lastMsg.value = `⏳ ${cmd}`
  try {
    // 与服务端 executeGMCommand 一致：聊天 GM 会去掉前导 /，此处对齐避免面板按钮失效
    const normalized = cmd.trim().replace(/^\//, '')
    await socketClient.sendGMCommand(normalized)
    lastMsg.value = `✓ ${cmd}`
  } catch (e: any) {
    lastErr.value = true
    lastMsg.value = `✗ ${cmd}: ${e?.message || e}`
  }
}

async function copy(text: string) {
  if (!text || text === '—') return
  try {
    await navigator.clipboard.writeText(text)
    lastErr.value = false
    lastMsg.value = `已复制 (${text.length} 字符)`
  } catch {
    lastErr.value = true
    lastMsg.value = '复制失败'
  }
}

// 精简玩家数据（移除大数组：hand, deck, discard, played, exiled）
function compactPlayer(p: any) {
  if (!p) return null
  return {
    id: p.id,
    name: p.name,
    ghostFire: p.ghostFire,
    damage: p.damage,
    reputation: p.reputation,
    cardsPlayed: p.cardsPlayed,
    isConnected: p.isConnected,
    isOfflineHosted: p.isOfflineHosted,
    isAI: p.isAI,
    handCount: p.hand?.length ?? 0,
    deckCount: p.deck?.length ?? 0,
    discardCount: p.discard?.length ?? 0,
    playedCount: p.played?.length ?? 0,
    exiledCount: p.exiled?.length ?? 0,
  }
}

// 精简场地数据
function compactField(f: any) {
  if (!f) return null
  return {
    yokaiSlots: f.yokaiSlots?.map((y: any) => y ? { name: y.name, hp: y.hp, maxHp: y.maxHp } : null),
    currentBoss: f.currentBoss ? { name: f.currentBoss.name, hp: f.bossCurrentHp, maxHp: f.currentBoss.maxHp } : null,
    bossCurrentHp: f.bossCurrentHp,
  }
}

// 精简gameState（约5KB而不是100KB+）
function compactGameState(gs: any) {
  if (!gs) return null
  return {
    phase: gs.phase,
    turnPhase: gs.turnPhase,
    turnNumber: gs.turnNumber,
    currentPlayerIndex: gs.currentPlayerIndex,
    currentPlayerId: gs.players?.[gs.currentPlayerIndex]?.id,
    pendingChoice: gs.pendingChoice,
    pendingYokaiRefresh: gs.pendingYokaiRefresh,
    turnHadKill: gs.turnHadKill,
    players: gs.players?.map(compactPlayer),
    field: compactField(gs.field),
    log: gs.log?.slice(-10), // 只保留最近10条日志
  }
}

async function copyDiagnosticJson() {
  const payload = {
    capturedAt: new Date().toISOString(),
    client: {
      serverUrl,
      socketId: playerId.value,
      playerName: socketClient.playerName.value,
      connectionStatus: status.value,
      latencyMs: latencyMs.value,
    },
    roomId: roomId.value,
    gameState: compactGameState(gs.value),
  }
  await copy(JSON.stringify(payload, null, 2))
}
</script>

<style scoped>
.dev-test-root {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 100000;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  pointer-events: auto;
}

.dev-tab {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(212, 165, 116, 0.6);
  background: rgba(26, 26, 46, 0.94);
  color: #d4a574;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.06em;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
}

.dev-tab:hover {
  background: rgba(40, 40, 70, 0.98);
}

.dev-panel {
  width: min(420px, calc(100vw - 24px));
  max-height: min(80vh, 640px);
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(212, 165, 116, 0.5);
  background: rgba(18, 18, 32, 0.97);
  color: #e8e8f0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
}

.dev-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(30, 30, 50, 0.95);
}

.dev-title {
  font-weight: 700;
  color: #d4a574;
}

.dev-btn-icon {
  border: none;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}

.dev-btn-icon:hover {
  color: #fff;
}

.dev-section {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dev-muted {
  color: #888;
  font-style: italic;
}

.dev-kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.dev-kv span {
  color: #9aa;
  flex-shrink: 0;
}

.dev-kv b {
  text-align: right;
  font-weight: 600;
}

.dev-kv b.ok { color: #7dcea0; }
.dev-kv b.warn { color: #f4d03f; }
.dev-kv b.bad { color: #e74c3c; }

.dev-wrap {
  white-space: normal;
  word-break: break-all;
}

.dev-code {
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  color: #c8b8ff;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dev-code:hover {
  background: rgba(80, 70, 120, 0.4);
}

.dev-code-wide {
  max-width: 240px;
}

.dev-code-tiny {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.4);
  color: #b8a8e8;
  cursor: pointer;
}

.dev-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #d4a574;
  margin-bottom: 8px;
  letter-spacing: 0.04em;
}

.dev-subtitle {
  font-size: 10px;
  color: #8aa;
  margin: 10px 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dev-mono-sm {
  font-size: 10px;
  font-weight: 500;
  word-break: break-all;
}

.dev-muted-inline {
  font-size: 11px;
  color: #666;
}

.dev-pre {
  margin: 0;
  padding: 8px;
  font-size: 10px;
  line-height: 1.35;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: pointer;
  color: #c5d4e0;
}

.dev-pre-block {
  margin: 0;
  padding: 8px;
  font-size: 10px;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: pointer;
  color: #aab;
  max-height: 120px;
  overflow: auto;
}

.dev-player-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.dev-player-card {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
}

.dev-player-card.me {
  border-color: rgba(102, 126, 234, 0.5);
  background: rgba(102, 126, 234, 0.12);
}

.dev-player-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.dev-p-idx {
  color: #888;
  font-size: 10px;
}

.dev-p-name {
  font-weight: 600;
  color: #dde;
}

.dev-p-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(102, 126, 234, 0.4);
  color: #fff;
}
.dev-p-badge.offline {
  background: rgba(231, 76, 60, 0.5);
}
.dev-p-badge.hosted {
  background: rgba(241, 196, 15, 0.5);
  color: #ffd;
}
.dev-p-badge.ai {
  background: rgba(155, 89, 182, 0.5);
}
.dev-player-card.offline {
  opacity: 0.7;
  border-color: rgba(231, 76, 60, 0.4);
}

.dev-p-rows {
  font-size: 10px;
  line-height: 1.45;
  color: #9aa;
}

.dev-copy-json {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(212, 165, 116, 0.4);
  background: rgba(212, 165, 116, 0.12);
  color: #d4a574;
  cursor: pointer;
  font-size: 11px;
}

.dev-copy-json:hover {
  background: rgba(212, 165, 116, 0.22);
}

.dev-actions-label {
  display: block;
  color: #9aa;
  margin-bottom: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dev-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.dev-cmd {
  flex: 1;
  min-width: 72px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(102, 126, 234, 0.45);
  background: rgba(102, 126, 234, 0.2);
  color: #c5caf5;
  cursor: pointer;
  font-size: 11px;
}

.dev-cmd-sm {
  flex: 0 1 auto;
  min-width: 56px;
}

.dev-cmd:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.35);
}

.dev-cmd:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dev-last {
  padding: 8px 10px;
  font-size: 11px;
  color: #7dcea0;
  word-break: break-word;
}

.dev-last.err {
  color: #f1948a;
}
</style>
