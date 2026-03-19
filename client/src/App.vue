<template>
  <div class="game-container">
    <!-- 顶部栏 -->
    <header class="header">
      <span class="title">🎴 御魂传说</span>
      <div v-if="inGame" class="resources">
        <span title="鬼火">🔥{{ player?.ghostFire || 0 }}/5</span>
        <span title="咒力">⚡{{ player?.spellPower || 0 }}</span>
        <span title="符咒">🏆{{ player?.totalCharm || 0 }}</span>
        <span title="回合">📅 R{{ gameState?.turnNumber || 0 }}</span>
      </div>
      <span class="status playing" v-if="inGame">单人测试</span>
      <span class="status" v-else>就绪</span>
    </header>

    <!-- 大厅 - 单人模式 -->
    <div v-if="!inGame" class="lobby">
      <div class="lobby-card">
        <h2>🎮 单人测试模式</h2>
        <p class="desc">验证游戏核心机制</p>
        <input v-model="playerName" placeholder="输入你的名字" class="name-input" />
        <button @click="startSinglePlayer" class="btn primary large">开始游戏</button>
        <div class="tips">
          <p>💡 初始牌库：7张灯笼鬼 + 3张招福达摩</p>
          <p>🎯 目标：退治妖怪，累积符咒</p>
        </div>
      </div>
    </div>

    <!-- 游戏界面 -->
    <div v-else class="game-board">
      
      <!-- 商店区 -->
      <div class="shop-row">
        <div class="shop-item" @click="buyToken('token1')" :class="{ disabled: (player?.spellPower || 0) < 1 }">
          <div class="token-card t1">招福达摩</div>
          <div class="shop-info">💰1 符咒+1</div>
          <div class="shop-count">{{ gameState?.field.tokenShop.token1 || 0 }}</div>
        </div>
        <div class="shop-item" @click="buyToken('token3')" :class="{ disabled: (player?.spellPower || 0) < 3 }">
          <div class="token-card t3">大吉达摩</div>
          <div class="shop-info">💰3 符咒+3</div>
          <div class="shop-count">{{ gameState?.field.tokenShop.token3 || 0 }}</div>
        </div>
        <div class="shop-item" @click="buyToken('token6')" :class="{ disabled: (player?.spellPower || 0) < 6 }">
          <div class="token-card t6">奉为达摩</div>
          <div class="shop-info">💰6 符咒+6</div>
          <div class="shop-count">{{ gameState?.field.tokenShop.token6 || 0 }}</div>
        </div>
      </div>

      <!-- 战场区 -->
      <div class="battlefield-row">
        <!-- 鬼王 -->
        <div class="boss-section">
          <div class="section-title">👹 鬼王</div>
          <div v-if="gameState?.field.currentBoss" class="boss-card">
            <div class="boss-name">{{ gameState.field.currentBoss.name }}</div>
            <div class="boss-hp">❤️ {{ gameState.field.bossHp }}</div>
          </div>
          <div v-else class="boss-empty">已击败</div>
        </div>

        <!-- 游荡妖怪 -->
        <div class="yokai-grid">
          <div class="section-title">👻 游荡妖怪 (点击退治)</div>
          <div class="yokai-cards">
            <div v-for="(yokai, i) in yokaiSlots" :key="i"
                 class="yokai-card"
                 :class="{ 
                   empty: !yokai,
                   affordable: yokai && (player?.spellPower || 0) >= (yokai.hp + (yokai.armor || 0))
                 }"
                 @click="yokai && killYokai(i)">
              <template v-if="yokai">
                <div class="yokai-name">{{ yokai.name }}</div>
                <div class="yokai-stats">
                  <span>❤️{{ yokai.hp }}</span>
                  <span v-if="yokai.cost">💰{{ yokai.cost }}</span>
                </div>
              </template>
              <template v-else>
                <div class="empty-slot">空</div>
              </template>
            </div>
          </div>
        </div>

        <!-- 妖怪牌库 -->
        <div class="deck-info">
          <div class="yokai-deck-count">
            妖怪牌库: {{ gameState?.field.yokaiDeck.length || 0 }}
          </div>
        </div>
      </div>

      <!-- 日志区 -->
      <div class="log-row">
        <div class="game-log" ref="logRef">
          <div v-for="(log, i) in recentLogs" :key="i" class="log-entry">
            {{ log.message }}
          </div>
        </div>
      </div>

      <!-- 玩家区 -->
      <div class="player-row">
        <!-- 式神 -->
        <div class="shikigami-section">
          <div class="section-title">🦊 式神</div>
          <div class="shikigami-list">
            <div v-for="s in player?.shikigami" :key="s.id" class="shikigami-card">
              <div class="shiki-name">{{ s.name }}</div>
              <div class="shiki-skill">{{ s.skill.name }} (🔥{{ s.skill.cost }})</div>
            </div>
          </div>
        </div>

        <!-- 牌库状态 -->
        <div class="deck-section">
          <div class="my-deck">
            <span class="deck-label">牌库</span>
            <span class="deck-num">{{ player?.deck.length || 0 }}</span>
          </div>
          <div class="my-discard">
            <span class="deck-label">弃牌</span>
            <span class="deck-num">{{ player?.discard.length || 0 }}</span>
          </div>
        </div>

        <!-- 手牌区 -->
        <div class="hand-section">
          <div class="section-title">🃏 手牌 (点击打出)</div>
          <div class="hand-cards">
            <div v-for="(card, i) in player?.hand" :key="card.instanceId"
                 class="hand-card"
                 :class="{ 
                   'ghost-fire': card.cardType === 'ghostFire',
                   'token': card.cardType === 'token',
                   'yokai': card.cardType === 'yokai'
                 }"
                 :style="getCardStyle(i, player?.hand.length || 0)"
                 @click="playCard(card.instanceId)">
              <div class="card-name">{{ card.name }}</div>
              <div class="card-stats">
                <span v-if="card.ghostFire">🔥+{{ card.ghostFire }}</span>
                <span>⚡+{{ card.hp }}</span>
                <span v-if="card.charm">🏆{{ card.charm }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-section">
          <button class="btn end-turn" @click="endTurn">
            结束回合 ➡️
          </button>
        </div>
      </div>

      <!-- 已打出区 -->
      <div v-if="player?.played.length" class="played-row">
        <div class="section-title">📜 本回合已打出</div>
        <div class="played-cards">
          <div v-for="card in player.played" :key="card.instanceId" class="played-card">
            {{ card.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { SinglePlayerGame } from './game/SinglePlayerGame'
import type { GameState, PlayerState } from '../../shared/types/game'
import type { CardInstance } from '../../shared/types/cards'

// 状态
const playerName = ref('阴阳师')
const inGame = ref(false)
const gameState = ref<GameState | null>(null)
let game: SinglePlayerGame | null = null

const logRef = ref<HTMLElement | null>(null)

// 计算属性
const player = computed(() => gameState.value?.players[0])

const yokaiSlots = computed(() => {
  return gameState.value?.field.yokaiSlots || []
})

const recentLogs = computed(() => {
  const logs = gameState.value?.log || []
  return logs.slice(-8)  // 只显示最近8条
})

// 开始单人游戏
function startSinglePlayer() {
  game = new SinglePlayerGame(playerName.value || '阴阳师', onStateChange)
  game.startGame()
  inGame.value = true
}

// 状态更新回调
function onStateChange(state: GameState) {
  gameState.value = state
  // 滚动日志到底部
  nextTick(() => {
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight
    }
  })
}

// 打出手牌
function playCard(cardInstanceId: string) {
  game?.playCard(cardInstanceId)
}

// 退治妖怪
function killYokai(slotIndex: number) {
  game?.killWithSpellPower(slotIndex)
}

// 购买令牌
function buyToken(tokenType: 'token1' | 'token3' | 'token6') {
  game?.buyToken(tokenType)
}

// 结束回合
function endTurn() {
  game?.endTurn()
}

// 手牌扇形布局
function getCardStyle(index: number, total: number) {
  if (total === 0) return {}
  const spread = 60
  const offset = (index - (total - 1) / 2) * spread
  const rotation = (index - (total - 1) / 2) * 3
  return {
    transform: `translateX(${offset}px) rotate(${rotation}deg)`,
    zIndex: index
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.game-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  font-family: 'Microsoft YaHei', sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(0,0,0,0.4);
  border-bottom: 1px solid #333;
}

.title {
  font-size: 20px;
  font-weight: bold;
}

.resources {
  display: flex;
  gap: 20px;
  font-size: 16px;
}

.resources span {
  padding: 4px 12px;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
}

.status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  background: #666;
}

.status.playing {
  background: #4CAF50;
}

/* 大厅 */
.lobby {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 60px);
}

.lobby-card {
  background: rgba(255,255,255,0.1);
  padding: 40px 60px;
  border-radius: 16px;
  text-align: center;
}

.lobby-card h2 {
  margin: 0 0 10px;
  font-size: 28px;
}

.desc {
  color: #aaa;
  margin-bottom: 20px;
}

.name-input {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102,126,234,0.4);
}

.btn.large {
  padding: 16px 48px;
  font-size: 18px;
}

.tips {
  margin-top: 30px;
  text-align: left;
  color: #888;
  font-size: 14px;
}

.tips p {
  margin: 8px 0;
}

/* 游戏板 */
.game-board {
  padding: 10px;
  transform: scale(0.85);
  transform-origin: top center;
}

.section-title {
  font-size: 14px;
  color: #888;
  margin-bottom: 8px;
}

/* 商店区 */
.shop-row {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 15px;
}

.shop-item {
  background: rgba(255,255,255,0.1);
  padding: 10px 15px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.shop-item:hover:not(.disabled) {
  background: rgba(255,255,255,0.2);
  transform: translateY(-2px);
}

.shop-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-card {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  margin-bottom: 5px;
}

.token-card.t1 { background: #4CAF50; }
.token-card.t3 { background: #FF9800; }
.token-card.t6 { background: #9C27B0; }

.shop-info {
  font-size: 12px;
  color: #aaa;
}

.shop-count {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

/* 战场区 */
.battlefield-row {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 15px;
}

.boss-section {
  text-align: center;
}

.boss-card {
  background: linear-gradient(135deg, #b71c1c 0%, #880e4f 100%);
  padding: 20px;
  border-radius: 8px;
  min-width: 100px;
}

.boss-name {
  font-weight: bold;
  margin-bottom: 8px;
}

.boss-hp {
  font-size: 20px;
}

.boss-empty {
  padding: 20px;
  color: #666;
}

.yokai-grid {
  flex: 1;
  max-width: 500px;
}

.yokai-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.yokai-card {
  background: rgba(255,255,255,0.1);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 70px;
}

.yokai-card:hover:not(.empty) {
  background: rgba(255,255,255,0.2);
}

.yokai-card.affordable {
  background: rgba(76, 175, 80, 0.3);
  border: 2px solid #4CAF50;
}

.yokai-card.empty {
  opacity: 0.3;
  cursor: default;
}

.yokai-name {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 5px;
}

.yokai-stats {
  font-size: 12px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.empty-slot {
  color: #666;
}

.deck-info {
  text-align: center;
  color: #666;
}

/* 日志区 */
.log-row {
  margin-bottom: 15px;
}

.game-log {
  background: rgba(0,0,0,0.3);
  padding: 10px;
  border-radius: 8px;
  height: 100px;
  overflow-y: auto;
  font-size: 13px;
}

.log-entry {
  padding: 3px 0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

/* 玩家区 */
.player-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 15px;
}

.shikigami-section {
  min-width: 150px;
}

.shikigami-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shikigami-card {
  background: rgba(156, 39, 176, 0.3);
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
}

.shiki-name {
  font-weight: bold;
}

.shiki-skill {
  color: #aaa;
  font-size: 11px;
}

.deck-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.my-deck, .my-discard {
  background: rgba(255,255,255,0.1);
  padding: 10px 15px;
  border-radius: 6px;
  text-align: center;
}

.deck-label {
  font-size: 12px;
  color: #888;
}

.deck-num {
  font-size: 20px;
  font-weight: bold;
  display: block;
}

/* 手牌区 */
.hand-section {
  flex: 1;
}

.hand-cards {
  display: flex;
  justify-content: center;
  min-height: 90px;
  padding: 10px;
  position: relative;
}

.hand-card {
  position: relative;
  width: 70px;
  height: 95px;
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hand-card:hover {
  transform: translateY(-15px) scale(1.1) !important;
  z-index: 100 !important;
  box-shadow: 0 8px 20px rgba(0,0,0,0.4);
}

.hand-card.ghost-fire {
  background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%);
}

.hand-card.token {
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
}

.hand-card.yokai {
  background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);
}

.card-name {
  font-size: 11px;
  font-weight: bold;
  text-align: center;
}

.card-stats {
  font-size: 10px;
  text-align: center;
}

.card-stats span {
  display: block;
}

/* 操作按钮 */
.action-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn.end-turn {
  background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
  color: white;
  padding: 15px 25px;
  font-size: 16px;
}

.btn.end-turn:hover {
  transform: translateY(-2px);
}

/* 已打出区 */
.played-row {
  background: rgba(0,0,0,0.2);
  padding: 10px;
  border-radius: 8px;
}

.played-cards {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.played-card {
  background: rgba(255,255,255,0.1);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
}
</style>