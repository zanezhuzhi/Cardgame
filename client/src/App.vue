<template>
  <div class="game-container">
    <!-- 顶部栏 -->
    <header class="header">
      <span class="title">🎴 御魂传说</span>
      <div v-if="inGame" class="resources">
        <span>🔥{{ ghostFire }}/5</span>
        <span>⚡{{ spellPower }}</span>
        <span>🏆{{ totalCharm }}</span>
      </div>
      <span class="status" :class="{ connected: isConnected }">
        {{ isConnected ? '已连接' : '未连接' }}
      </span>
    </header>

    <!-- 大厅 -->
    <div v-if="!inGame" class="lobby">
      <div class="lobby-card">
        <h2>游戏大厅</h2>
        <div v-if="!currentRoom">
          <button @click="createRoom" class="btn primary">创建房间</button>
          <div class="join-form">
            <input v-model="joinRoomId" placeholder="输入房间ID" />
            <button @click="joinRoom" class="btn">加入</button>
          </div>
        </div>
        <div v-else>
          <p>房间: {{ currentRoom.name }}</p>
          <p class="room-id">ID: {{ currentRoom.id }}</p>
          <div class="players">
            <div v-for="p in currentRoom.players" :key="p.id" class="player-tag">
              {{ p.name }} <span v-if="p.id === currentRoom.hostId">👑</span>
            </div>
          </div>
          <div class="actions">
            <button @click="leaveRoom" class="btn">离开</button>
            <button v-if="isHost" @click="startGame" class="btn primary">开始游戏</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏界面 -->
    <div v-else class="game-board">
      
      <!-- 战场顶部：商店区 -->
      <div class="shop-row">
        <div class="shop-item shikigami-deck">
          <div class="deck-back">?</div>
          <div class="shop-label">式神卡组</div>
          <div class="shop-count">{{ shikigamiDeckCount }}</div>
        </div>
        <div class="shop-item" @click="buySpell('basic')">
          <div class="spell-card basic">基础术式</div>
          <div class="shop-label">咒力+1</div>
          <div class="shop-count">{{ basicSpellCount }}</div>
        </div>
        <div class="shop-item" @click="buySpell('mid')">
          <div class="spell-card mid">中级符咒</div>
          <div class="shop-label">咒力+2</div>
          <div class="shop-count">{{ midSpellCount }}</div>
        </div>
        <div class="shop-item" @click="buySpell('high')">
          <div class="spell-card high">高级符咒</div>
          <div class="shop-label">咒力+3</div>
          <div class="shop-count">{{ highSpellCount }}</div>
        </div>
      </div>

      <!-- 战场中部：游荡妖怪区 -->
      <div class="battlefield-row">
        <!-- 鬼王区 -->
        <div class="boss-section">
          <div class="section-title">鬼王</div>
          <div v-if="currentBoss" 
               class="boss-card" 
               :class="{ selected: selectedTarget === 'boss' }"
               @click="selectTarget('boss')">
            <img :src="bossImage" alt="鬼王" />
            <div class="card-hp">❤️{{ currentBoss.health }}</div>
          </div>
        </div>

        <!-- 游荡妖怪展示区 (2行3列) -->
        <div class="yokai-grid">
          <div class="section-title">游荡妖怪</div>
          <div class="yokai-cards">
            <div v-for="(y, i) in displayedYokai" :key="y.id"
                 class="yokai-card"
                 :class="{ selected: selectedTarget === y.id }"
                 @click="selectTarget(y.id)">
              <img :src="getYokaiImage(i + 1)" alt="妖怪" />
              <div class="card-stats">
                <span>❤️{{ y.health }}</span>
                <span>🏆{{ y.charm }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 流浪妖怪卡组 -->
        <div class="yokai-deck-section">
          <div class="section-title">妖怪卡组</div>
          <div class="yokai-deck">
            <div class="deck-top-card">
              <img :src="getYokaiImage(7)" alt="卡组顶牌" />
            </div>
            <div class="deck-count">{{ yokaiDeckCount }}</div>
          </div>
        </div>
      </div>

      <!-- 公共超度区 -->
      <div class="exile-row">
        <div class="exile-zone">
          <span class="exile-label">公共超度区</span>
          <span class="exile-count">{{ exileCount }} 张</span>
        </div>
      </div>

      <!-- 玩家区域 -->
      <div class="player-row">
        <!-- 式神区 -->
        <div class="shikigami-section">
          <div class="section-title">我的式神</div>
          <div class="shikigami-list">
            <div v-for="s in myShikigamis" :key="s.id" 
                 class="shikigami-card"
                 :class="{ usable: ghostFire >= s.cost }"
                 @click="useSkill(s)">
              <img :src="getShikigamiImage(s.imageId)" alt="式神" />
              <div class="shiki-cost">🔥{{ s.cost }}</div>
            </div>
          </div>
        </div>

        <!-- 牌库/弃牌 -->
        <div class="deck-section">
          <div class="my-deck">
            <div class="deck-label">牌库</div>
            <div class="deck-num">{{ deckCount }}</div>
          </div>
          <div class="my-discard">
            <div class="deck-label">弃牌</div>
            <div class="deck-num">{{ discardCount }}</div>
          </div>
        </div>

        <!-- 手牌区 -->
        <div class="hand-section">
          <div class="hand-cards">
            <div v-for="(card, i) in handCards" :key="card.id"
                 class="hand-card"
                 :class="{ selected: selectedCard === card.id }"
                 :style="getCardStyle(i)"
                 @click="selectCard(card.id)">
              <div class="card-name">{{ card.name }}</div>
              <div class="card-power">⚡+{{ card.power }}</div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-section">
          <button class="btn play" :disabled="!selectedCard" @click="playCard">打出</button>
          <button class="btn attack" :disabled="spellPower === 0 || !selectedTarget" @click="attack">攻击</button>
          <button class="btn end" @click="endTurn">结束回合</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

const SERVER_URL = 'http://localhost:3000'

// 状态
const socket = ref<Socket | null>(null)
const isConnected = ref(false)
const currentRoom = ref<any>(null)
const joinRoomId = ref('')
const inGame = ref(false)

// 资源
const ghostFire = ref(1)
const spellPower = ref(0)
const totalCharm = ref(0)
const deckCount = ref(10)
const discardCount = ref(0)
const exileCount = ref(0)

// 商店库存
const shikigamiDeckCount = ref(22)
const basicSpellCount = ref(30)
const midSpellCount = ref(20)
const highSpellCount = ref(10)
const yokaiDeckCount = ref(84)

// 卡牌
const handCards = ref([
  { id: '1', name: '基础术式', power: 1 },
  { id: '2', name: '基础术式', power: 1 },
  { id: '3', name: '基础术式', power: 1 },
  { id: '4', name: '破碎符咒', power: 0, charm: 1 },
  { id: '5', name: '基础术式', power: 1 },
])

const myShikigamis = ref([
  { id: 's1', name: '妖刀姬', imageId: '01', cost: 3 },
  { id: 's2', name: '大天狗', imageId: '02', cost: 4 },
])

const displayedYokai = ref([
  { id: 'y1', health: 4, charm: 1 },
  { id: 'y2', health: 3, charm: 1 },
  { id: 'y3', health: 5, charm: 2 },
  { id: 'y4', health: 6, charm: 0 },
  { id: 'y5', health: 4, charm: 3 },
  { id: 'y6', health: 7, charm: 2 },
])

const currentBoss = ref({ health: 8, charm: 5 })

// 选择状态
const selectedCard = ref<string | null>(null)
const selectedTarget = ref<string | null>(null)

// 计算
const isHost = computed(() => currentRoom.value?.hostId === socket.value?.id)

const bossImage = computed(() => {
  return new URL('./assets/cards/鬼王01.png', import.meta.url).href
})

function getShikigamiImage(id: string) {
  return new URL(`./assets/cards/式神${id}.png`, import.meta.url).href
}

function getYokaiImage(num: number) {
  return new URL(`./assets/cards/others/各2张/游荡${num}.png`, import.meta.url).href
}

function getCardStyle(index: number) {
  const total = handCards.value.length
  const spread = 50
  const offset = (index - (total - 1) / 2) * spread
  const rotation = (index - (total - 1) / 2) * 4
  return {
    transform: `translateX(${offset}px) rotate(${rotation}deg)`,
    zIndex: index
  }
}

// 生命周期
onMounted(() => {
  socket.value = io(SERVER_URL)
  socket.value.on('connect', () => { isConnected.value = true })
  socket.value.on('disconnect', () => { 
    isConnected.value = false
    currentRoom.value = null
    inGame.value = false
  })
})

onUnmounted(() => {
  socket.value?.disconnect()
})

// 房间
function createRoom() {
  socket.value?.emit('room:create', `房间${Date.now().toString().slice(-4)}`, (room: any) => {
    currentRoom.value = room
  })
}

function joinRoom() {
  if (!joinRoomId.value) return
  socket.value?.emit('room:join', joinRoomId.value, (room: any) => {
    if (room) currentRoom.value = room
    else alert('无法加入')
  })
}

function leaveRoom() {
  socket.value?.emit('room:leave')
  currentRoom.value = null
}

function startGame() {
  inGame.value = true
}

// 游戏操作
function selectCard(id: string) {
  selectedCard.value = selectedCard.value === id ? null : id
}

function selectTarget(id: string) {
  selectedTarget.value = selectedTarget.value === id ? null : id
}

function playCard() {
  if (!selectedCard.value) return
  const card = handCards.value.find(c => c.id === selectedCard.value)
  if (card) {
    spellPower.value += card.power
    handCards.value = handCards.value.filter(c => c.id !== selectedCard.value)
  }
  selectedCard.value = null
}

function buySpell(type: string) {
  // 购买阴阳术逻辑
  console.log('购买', type)
}

function attack() {
  if (!selectedTarget.value || spellPower.value === 0) return
  
  if (selectedTarget.value === 'boss' && currentBoss.value) {
    currentBoss.value.health -= spellPower.value
    if (currentBoss.value.health <= 0) {
      totalCharm.value += currentBoss.value.charm
      currentBoss.value = null as any
    }
  } else {
    const yokai = displayedYokai.value.find(y => y.id === selectedTarget.value)
    if (yokai) {
      yokai.health -= spellPower.value
      if (yokai.health <= 0) {
        totalCharm.value += yokai.charm
        displayedYokai.value = displayedYokai.value.filter(y => y.id !== selectedTarget.value)
      }
    }
  }
  
  spellPower.value = 0
  selectedTarget.value = null
}

function useSkill(shiki: any) {
  if (ghostFire.value >= shiki.cost) {
    ghostFire.value -= shiki.cost
    spellPower.value += 3
  }
}

function endTurn() {
  spellPower.value = 0
  ghostFire.value = Math.min(ghostFire.value + 1, 5)
  discardCount.value += handCards.value.length
  handCards.value = [
    { id: Date.now() + '1', name: '基础术式', power: 1 },
    { id: Date.now() + '2', name: '基础术式', power: 1 },
    { id: Date.now() + '3', name: '基础术式', power: 1 },
    { id: Date.now() + '4', name: '基础术式', power: 1 },
    { id: Date.now() + '5', name: '基础术式', power: 1 },
  ]
  deckCount.value = Math.max(0, deckCount.value - 5)
}
</script>

<style scoped>
* { box-sizing: border-box; }

.game-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg, #e8e0d0, #d4c8b8);
  color: #333;
  font-family: 'Microsoft YaHei', sans-serif;
  display: flex;
  flex-direction: column;
}

/* 顶部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 1.5rem;
  background: linear-gradient(90deg, #8b4513, #a0522d);
  border-bottom: 3px solid #ffd700;
  color: #fff;
}

.title {
  font-size: 1.3rem;
  color: #ffd700;
  font-weight: bold;
}

.resources {
  display: flex;
  gap: 1rem;
  font-size: 1rem;
}

.resources span {
  background: rgba(0,0,0,0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
}

.status {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  background: #c0392b;
  font-size: 0.8rem;
}

.status.connected {
  background: #27ae60;
}

/* 大厅 */
.lobby {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(180deg, #2d1b4e, #1a0a2e);
}

.lobby-card {
  background: rgba(45, 27, 78, 0.95);
  padding: 2rem;
  border-radius: 16px;
  min-width: 360px;
  border: 2px solid #ffd700;
  text-align: center;
  color: #fff;
}

.lobby-card h2 {
  color: #ffd700;
  margin-bottom: 1.5rem;
}

.join-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.join-form input {
  flex: 1;
  padding: 0.6rem;
  border: 1px solid #ffd700;
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
  color: #fff;
}

.room-id { color: #888; font-size: 0.8rem; }

.players {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin: 1rem 0;
}

.player-tag {
  background: rgba(255,215,0,0.2);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #ffd700;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

/* 按钮 */
.btn {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: all 0.2s;
  color: #fff;
}

.btn:hover { transform: translateY(-2px); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.btn.primary { background: linear-gradient(135deg, #8b4513, #d4a017); }
.btn.play { background: #27ae60; }
.btn.attack { background: #c0392b; }
.btn.end { background: #7f8c8d; }

/* 游戏界面 */
.game-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.3rem;
  gap: 0.3rem;
  transform: scale(0.85);
  transform-origin: top center;
}

.section-title {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.3rem;
  text-align: center;
}

/* 商店行 */
.shop-row {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
  background: #b8d4e8;
  border-radius: 8px;
  border: 2px solid #7ab;
}

.shop-item {
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.shop-item:hover {
  transform: scale(1.05);
}

.deck-back {
  width: 60px;
  height: 80px;
  background: linear-gradient(135deg, #4a3a6a, #2a1a4a);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #ffd700;
  border: 2px solid #ffd700;
}

.spell-card {
  width: 60px;
  height: 80px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  color: #fff;
  text-align: center;
  padding: 0.3rem;
}

.spell-card.basic { background: linear-gradient(135deg, #3498db, #2980b9); }
.spell-card.mid { background: linear-gradient(135deg, #9b59b6, #8e44ad); }
.spell-card.high { background: linear-gradient(135deg, #e74c3c, #c0392b); }

.shop-label {
  font-size: 0.7rem;
  color: #555;
  margin-top: 0.2rem;
}

.shop-count {
  font-size: 0.75rem;
  color: #333;
  font-weight: bold;
}

/* 战场行 */
.battlefield-row {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
}

/* 鬼王区 */
.boss-section {
  width: 100px;
}

.boss-card {
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.2s;
  position: relative;
}

.boss-card img {
  width: 100%;
  display: block;
}

.boss-card:hover { transform: scale(1.02); }
.boss-card.selected {
  border-color: #ff4444;
  box-shadow: 0 0 12px rgba(255,68,68,0.6);
}

.card-hp {
  position: absolute;
  bottom: 5px;
  left: 5px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* 游荡妖怪网格 */
.yokai-grid {
  flex: 1;
}

.yokai-cards {
  display: grid;
  grid-template-columns: repeat(3, 90px);
  grid-template-rows: repeat(2, auto);
  gap: 0.4rem;
}

.yokai-card {
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  position: relative;
  background: #fff;
}

.yokai-card img {
  width: 100%;
  display: block;
}

.yokai-card:hover { transform: translateY(-3px); }
.yokai-card.selected {
  border-color: #ffd700;
  box-shadow: 0 0 10px rgba(255,215,0,0.6);
}

.card-stats {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 0.2rem;
  font-size: 0.7rem;
  display: flex;
  justify-content: space-around;
}

/* 妖怪卡组 */
.yokai-deck-section {
  width: 70px;
}

.yokai-deck {
  position: relative;
}

.deck-top-card {
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #8b4513;
}

.deck-top-card img {
  width: 100%;
  display: block;
}

.yokai-deck .deck-count {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background: #8b4513;
  color: #fff;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: bold;
}

/* 超度区 */
.exile-row {
  padding: 0.3rem;
}

.exile-zone {
  background: #9ed0f0;
  border: 2px solid #5ba;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.exile-label {
  font-weight: bold;
  color: #246;
}

.exile-count {
  color: #468;
}

/* 玩家行 */
.player-row {
  height: 140px;
  display: flex;
  gap: 0.8rem;
  padding: 0.4rem;
  background: rgba(0,0,0,0.1);
  border-radius: 6px;
}

/* 式神区 */
.shikigami-section {
  width: 130px;
}

.shikigami-list {
  display: flex;
  gap: 0.3rem;
}

.shikigami-card {
  width: 55px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.shikigami-card img {
  width: 100%;
  display: block;
}

.shikigami-card.usable {
  border-color: #ffd700;
  box-shadow: 0 0 6px rgba(255,215,0,0.5);
}

.shikigami-card:hover { transform: scale(1.03); }

.shiki-cost {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.65rem;
}

/* 牌库区 */
.deck-section {
  width: 60px;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.my-deck, .my-discard {
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
  padding: 0.5rem;
  text-align: center;
}

.deck-label {
  font-size: 0.7rem;
  color: #666;
}

.deck-num {
  font-size: 1.3rem;
  font-weight: bold;
  color: #333;
}

/* 手牌区 */
.hand-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hand-cards {
  position: relative;
  height: 100px;
  width: 350px;
}

.hand-card {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 55px;
  height: 80px;
  margin-left: -27px;
  background: linear-gradient(135deg, #f5f0e6, #e8e0d0);
  border: 2px solid #8b4513;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.3rem;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
}

.hand-card:hover {
  transform: translateY(-20px) scale(1.1) !important;
  z-index: 100 !important;
  border-color: #ffd700;
}

.hand-card.selected {
  border-color: #27ae60;
  box-shadow: 0 0 10px rgba(39,174,96,0.5);
  transform: translateY(-15px) !important;
}

.card-name {
  font-size: 0.6rem;
  text-align: center;
  color: #333;
}

.card-power {
  font-size: 1rem;
  font-weight: bold;
  color: #3498db;
  margin-top: 0.3rem;
}

/* 操作区 */
.action-section {
  width: 100px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  justify-content: center;
}

.action-section .btn {
  padding: 0.5rem;
  font-size: 0.85rem;
}
</style>