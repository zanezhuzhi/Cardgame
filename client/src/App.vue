<template>
  <div class="game-container">
    <!-- 大厅 -->
    <div v-if="!inGame" class="lobby">
      <div class="lobby-card">
        <h1>🎴 御魂传说</h1>
        <h2>单人测试模式</h2>
        <input v-model="playerName" placeholder="输入名字" class="name-input" />
        <button @click="startGame" class="btn primary">开始游戏</button>
        <p class="tips">初始牌库：6基础术式 + 3招福达摩</p>
      </div>
    </div>

    <!-- 游戏界面 -->
    <div v-else class="game-board">
      <!-- 顶部栏 (height:150px) -->
      <div class="top-row">
        <!-- 回合数 -->
        <div class="turn-display">第{{state?.turnNumber||1}}轮</div>
        
        <!-- 6个玩家信息 -->
        <div class="player-panel">
          <div class="player-info-slot" v-for="i in 6" :key="i">
            <div class="player-avatar" :class="{active: i===1}">
              <span v-if="i===1">{{player?.name?.charAt(0)||'P'}}</span>
            </div>
            <div class="player-stats">
              <div class="mini-stat"><span>🃏</span>{{i===1 ? player?.hand?.length||0 : 0}}</div>
              <div class="mini-stat"><span>👑</span>{{i===1 ? player?.totalCharm||0 : 0}}</div>
            </div>
          </div>
        </div>
        
        <!-- LOGO -->
        <div class="logo-panel">
          <div class="logo">百鬼夜行</div>
        </div>
      </div>

      <!-- 中间：鬼王+妖怪+右侧信息 -->
      <div class="mid-row">
        <!-- 鬼王区 -->
        <div class="boss-panel">
          <div class="panel-title">👹 鬼王区</div>
          <div v-if="boss" class="boss-card"
               :class="{
                 'boss-attackable': canAttackBoss,
                 'boss-defeated': isBossDefeated,
                 'boss-hint': allYokaiCleared && !isBossDefeated && state?.turnPhase === 'action'
               }"
               @click="hitBoss"
               @mouseenter="showBossTooltip($event, boss)"
               @mouseleave="hideTooltip">
            <img v-if="getCardImage(boss)" :src="getCardImage(boss)" class="card-art boss-art" />
            <!-- 可攻击时的引导覆盖层 -->
            <div v-if="canAttackBoss" class="boss-attack-overlay">
              ⚔️ 点击攻击<br/>
              <span class="boss-dmg-preview">{{ player?.damage }} 伤害</span>
            </div>
            <!-- 等待退治/超度选择时 -->
            <div v-if="isBossDefeated" class="boss-defeated-overlay">💀 已击败<br/>请选择...</div>
            <div class="boss-card-info">
              <div class="boss-stage">Ⅰ</div>
              <div class="boss-name">{{boss.name}}</div>
              <div class="boss-hp">❤️{{state?.field.bossCurrentHp}}/{{boss.hp}}</div>
              <div class="boss-charm">👑+{{boss.charm||0}}</div>
            </div>
          </div>
          <!-- 妖怪全清但伤害不足时的提示 -->
          <div v-if="allYokaiCleared && state?.turnPhase === 'action' && !canAttackBoss && boss"
               class="boss-no-dmg-hint">
            妖怪已清！<br/>积累伤害后攻击鬼王
          </div>
          <div v-else class="boss-empty">全部击败</div>
          <div class="boss-remain">剩余:{{state?.field.bossDeck.length||0}}</div>
        </div>
        <div class="yokai-panel">
          <div class="panel-title">👻 游荡妖怪区</div>
          <div class="yokai-grid">
            <div v-for="(y,i) in yokai" :key="i" 
                 class="yokai-card" 
                 :class="{
                   empty: !y, 
                   wounded: y && isWounded(y) && !isKilled(y),
                   canKill: y && canKillYokai(y),
                   killed: y && isKilled(y),
                   selecting: selectingTarget && y
                 }"
                 @click="y && handleYokaiClick(i, y)"
                 @mouseenter="y && showTooltip($event, y)"
                 @mouseleave="hideTooltip">
              <template v-if="y">
                <img v-if="getCardImage(y)" :src="getCardImage(y)" class="card-art yokai-art" />
                <div class="yokai-info">
                  <div class="y-name">{{y.name}}</div>
                  <div class="y-stat">
                    <span :class="{'hp-damaged': getYokaiCurrentHp(y) < y.hp}">❤️{{getYokaiCurrentHp(y)}}/{{y.hp}}</span>
                    <span>👑{{y.charm||0}}</span>
                  </div>
                </div>
                <div v-if="isKilled(y)" class="killed-badge">💀 已击杀</div>
              </template>
            </div>
          </div>
          <div class="yokai-label">游荡妖怪</div>
        </div>
        
        <!-- 右侧信息区 -->
        <div class="info-side-panel">
          <div class="info-box">
            <div v-for="(l,i) in logs.slice(-8)" :key="i" class="info-line">{{l.message}}</div>
          </div>
          <div class="action-buttons">
            <button class="side-btn" @click="getSpell" :disabled="!canSpell">获得阴阳术</button>
            <button class="side-btn" @click="openShikigamiModal" v-if="canAcquireShikigami || canReplaceShikigami">
              {{ canAcquireShikigami ? '获得式神' : '置换式神' }}
            </button>
            <button class="side-btn" @click="showExiled=true">查看超度区</button>
          </div>
        </div>
      </div>
      
      <!-- 中部个人信息区 (top:640px) -->
      <div class="personal-info-row">
        <div class="self-info">
          <div class="avatar-box"></div>
          <div class="stat-box">
            <div class="stat-item"><span>👑</span><b>{{player?.totalCharm||0}}</b></div>
            <div class="stat-item"><span>🃏</span><b>{{(player?.deck?.length||0)+(player?.hand?.length||0)+(player?.discard?.length||0)}}</b></div>
          </div>
        </div>
        <div class="deck-discard-area">
          <div class="pile-box deck-box">
            <b>{{player?.deck?.length||0}}</b>
            <span>牌库</span>
          </div>
          <div class="pile-box discard-box">
            <b>{{player?.discard?.length||0}}</b>
            <span>弃牌堆</span>
          </div>
        </div>
      </div>

      <!-- 底部：式神+手牌+结束 (top:800px) -->
      <div class="bot-row">
        <!-- 式神区 -->
        <div class="shiki-panel">
          <div class="shiki-label">式神</div>
          <div class="shiki-cards">
            <div v-for="(s,i) in player?.shikigami" :key="s.id" 
                 class="shiki-card" 
                 :class="{tired:player?.shikigamiState[i]?.isExhausted}"
                 @click="useSkill(s.id)"
                 @mouseenter="showShikigamiTooltip($event, s)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(s)" :src="getCardImage(s)" class="card-art shiki-art" />
              <div class="shiki-info">
                <div class="s-name">{{s.name}}</div>
                <div class="s-skill" v-if="s.skill">【启】{{s.skill.name}}(🔥{{s.skill.cost||0}})</div>
              </div>
            </div>
          </div>
          <div class="ghost-fire-bar">
            <div v-for="i in 5" :key="i" class="fire-slot" :class="{active: i <= (player?.ghostFire||0)}"></div>
          </div>
        </div>
        
        <!-- 手牌区 -->
        <div class="hand-panel">
          <div class="damage-display">
            <span>⚔️</span><b>{{player?.damage||0}}</b>
          </div>
          <div class="hand-label">手牌</div>
          <div class="hand-cards">
            <div v-for="c in player?.hand" :key="c.instanceId" 
                 class="hand-card" 
                 :class="[cardType(c), {selecting: selectingCards, unplayable: !canPlay(c)}]"
                 @click="handleCardClick(c)"
                 @mouseenter="showTooltip($event, c)"
                 @mouseleave="hideTooltip">
              <img v-if="getCardImage(c)" :src="getCardImage(c)" class="card-art hand-art" />
              <div class="card-info">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat" v-if="c.cardType === 'spell' || c.cardType === 'yokai'">⚔️{{c.damage||c.hp||1}}</div>
                <div class="c-stat" v-else-if="c.cardType === 'token'">🎁</div>
                <div class="c-stat" v-else-if="c.cardType === 'penalty'">💔{{c.charm||0}}</div>
                <div class="c-stat" v-else>—</div>
              </div>
            </div>
          </div>
        </div>
        <div class="end-panel">
          <button class="end-btn" @click="endTurn" :disabled="state?.turnPhase!=='action'">
            结束回合 →
          </button>
          <div class="phase">{{phaseText}}</div>
        </div>
      </div>

      <!-- 弹窗：妖怪刷新确认 -->
      <div class="modal" v-if="state?.pendingYokaiRefresh">
        <div class="modal-box">
          <p>⚠️ 是否刷新场上妖怪？</p>
          <button class="btn primary" @click="refresh(true)">刷新</button>
          <button class="btn" @click="refresh(false)">保持</button>
        </div>
      </div>
      
      <!-- 弹窗：式神阶段 -->
      <div class="modal" v-else-if="state?.turnPhase==='shikigami'">
        <div class="modal-box">
          <p>📋 式神调整阶段</p>
          <button class="btn primary" @click="confirmShiki">进入行动阶段</button>
        </div>
      </div>

      <!-- 弹窗：效果选择（CHOICE效果） -->
      <div class="modal" v-if="choiceModal.show">
        <div class="modal-box choice-modal">
          <p class="modal-title">🎯 选择一个效果</p>
          <div class="choice-options">
            <button v-for="(opt, i) in choiceModal.options" :key="i"
                    class="choice-btn" @click="resolveChoice(i)">
              {{opt}}
            </button>
          </div>
        </div>
      </div>

      <!-- 弹窗：卡牌选择（弃牌/超度选择等） -->
      <div class="modal" v-if="cardSelectModal.show">
        <div class="modal-box card-select-modal">
          <p class="modal-title">{{cardSelectModal.title}}</p>
          <p class="modal-hint">选择 {{cardSelectModal.count}} 张牌</p>
          <div class="card-select-grid">
            <div v-for="c in cardSelectModal.candidates" :key="c.instanceId"
                 class="select-card" 
                 :class="{selected: cardSelectModal.selected.includes(c.instanceId)}"
                 @click="toggleCardSelect(c.instanceId)">
              <div class="c-name">{{c.name}}</div>
              <div class="c-stat">{{c.damage ? `⚔️${c.damage}` : `❤️${c.hp}`}}</div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn primary" 
                    :disabled="cardSelectModal.selected.length !== cardSelectModal.count"
                    @click="resolveCardSelect">
              确认
            </button>
          </div>
        </div>
      </div>

      <!-- 弹窗：目标选择 -->
      <div class="modal" v-if="targetModal.show">
        <div class="modal-box target-modal">
          <p class="modal-title">🎯 选择目标</p>
          <div class="target-grid">
            <div v-for="c in targetModal.candidates" :key="c.instanceId"
                 class="target-card" @click="resolveTarget(c.instanceId)">
              <div class="c-name">{{c.name}}</div>
              <div class="c-stat">❤️{{c.hp}}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 弹窗：超度区查看 -->
      <div class="modal" v-if="showExiled">
        <div class="modal-box exiled-modal">
          <p class="modal-title">📜 超度区</p>
          <div class="exiled-cards" v-if="player?.exiled?.length">
            <div v-for="c in player.exiled" :key="c.instanceId" class="exiled-card">
              {{c.name}}
            </div>
          </div>
          <p v-else class="empty-hint">暂无超度的卡牌</p>
          <button class="btn" @click="showExiled=false">关闭</button>
        </div>
      </div>

      <!-- 弹窗：式神获取/置换 -->
      <div class="modal" v-if="shikigamiModal.show">
        <div class="modal-box shikigami-modal">
          <p class="modal-title">{{ shikigamiModal.isReplace ? '🔄 置换式神' : '🦊 获取式神' }}</p>
          
          <!-- 步骤1：选择超度的阴阳术 -->
          <div v-if="shikigamiModal.step === 1" class="shikigami-step">
            <p class="step-hint" v-if="!shikigamiModal.isReplace">
              选择阴阳术超度（≥5点，必须包含高级符咒）
            </p>
            <p class="step-hint" v-else>
              选择1张高级符咒或专属符咒
            </p>
            <p class="step-info">
              当前已选：{{shikigamiModal.selectedDamage}}点伤害
              <span v-if="!shikigamiModal.isReplace">(需要≥5点+含高级)</span>
              <span v-else>(需要3点)</span>
            </p>
            <div class="spell-select-grid">
              <div v-for="c in spellCardsInHand" :key="c.instanceId"
                   class="spell-card" 
                   :class="{selected: shikigamiModal.selectedSpells.includes(c.instanceId)}"
                   @click="toggleSpellForShikigami(c)">
                <div class="c-name">{{c.name}}</div>
                <div class="c-stat">⚔️{{c.damage||c.hp||1}}</div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn" @click="closeShikigamiModal">取消</button>
              <button class="btn primary" 
                      :disabled="!isValidShikigamiSelection"
                      @click="nextShikigamiStep">
                下一步
              </button>
            </div>
          </div>

          <!-- 步骤2（置换时）：选择要替换的式神 -->
          <div v-else-if="shikigamiModal.step === 2 && shikigamiModal.isReplace" class="shikigami-step">
            <p class="step-hint">选择要替换的式神</p>
            <div class="old-shiki-grid">
              <div v-for="s in player?.shikigami" :key="s.id"
                   class="old-shiki-card" @click="selectOldShikigami(s.id)">
                <div class="s-name">{{s.name}}</div>
                <div class="s-rarity">{{s.rarity}}</div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn" @click="shikigamiModal.step = 1">返回</button>
            </div>
          </div>

          <!-- 步骤3：选择新式神 -->
          <div v-else-if="shikigamiModal.step === 3" class="shikigami-step">
            <p class="step-hint">选择一个新式神</p>
            <div class="new-shiki-grid">
              <div v-for="s in shikigamiModal.candidates" :key="s.id"
                   class="new-shiki-card" @click="selectNewShikigami(s)">
                <div class="s-name">{{s.name}}</div>
                <div class="s-rarity" :class="'rarity-'+s.rarity?.toLowerCase()">{{s.rarity}}</div>
                <div class="s-charm">👑{{s.charm}}</div>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn" @click="closeShikigamiModal">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 卡牌悬浮提示 -->
      <Teleport to="body">
        <div class="card-tooltip" v-if="tooltip.show" :style="tooltipStyle">
          <div class="tooltip-header">
            <span class="tooltip-name">{{tooltip.card?.name}}</span>
            <span class="tooltip-type" :class="tooltip.typeClass">{{tooltip.typeLabel}}</span>
          </div>
          <div class="tooltip-stats" v-if="tooltip.stats">
            <span v-for="(stat, key) in tooltip.stats" :key="key" class="stat-item">
              {{stat.icon}}{{stat.value}}
            </span>
          </div>
          <div class="tooltip-subtype" v-if="tooltip.card?.subtype">
            {{tooltip.card.subtype}}
          </div>
          <div class="tooltip-effect" v-if="tooltip.effect">
            {{tooltip.effect}}
          </div>
          <div class="tooltip-passive" v-if="tooltip.passive">
            <span class="passive-label">【被动】{{tooltip.passive.name}}</span>
            <p>{{tooltip.passive.effect}}</p>
          </div>
          <div class="tooltip-skill" v-if="tooltip.skill">
            <span class="skill-label">【启】{{tooltip.skill.name}} (🔥{{tooltip.skill.cost}})</span>
            <p>{{tooltip.skill.effect}}</p>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive, onMounted } from 'vue'
import { SinglePlayerGame } from './game/SinglePlayerGame'
import type { GameState } from '../../shared/types/game'
import type { CardInstance } from '../../shared/types/cards'

// ── 卡牌图片路径映射 ──────────────────────────────────────
// id格式：boss_001 → 101.webp, yokai_001 → 201.webp, shikigami_001 → 401.webp
// spell_001 → 601.webp, penalty_001 → 701.webp
// 图片编号规则（按 妖怪卡.md 文档顺序）：
//   201 = 招福达摩(token_001)
//   202 = 赤舌(yokai_001), 203 = 唐纸伞妖(yokai_002) ... 239 = 三味(yokai_038)
//   101-110 = 鬼王, 401-424 = 式神, 601-603 = 阴阳术, 701-702 = 恶评
function getCardImage(card: CardInstance | any): string {
  const rawId = card?.cardId || card?.id
  if (!rawId) return ''
  const m = String(rawId).match(/^(\w+)_(\d+)$/)
  if (!m) return ''
  const [, type, num] = m
  const n = parseInt(num)

  let path = ''
  if (type === 'token')     path = `/images/yokai/${200 + n}.webp`          // token_001 → 201
  else if (type === 'yokai')     path = `/images/yokai/${201 + n}.webp`     // yokai_001 → 202
  else if (type === 'boss')      path = `/images/bosses/${100 + n}.webp`    // boss_001 → 101
  else if (type === 'shikigami') path = `/images/shikigami/${400 + n}.webp` // shikigami_001 → 401
  else if (type === 'spell')     path = `/images/spells/${600 + n}.webp`    // spell_001 → 601
  else if (type === 'penalty')   path = `/images/curses/${700 + n}.webp`    // penalty_001 → 701

  return path
}

// 禁用全局拖拽默认行为，防止长按出现多选框/图片拖走
onMounted(() => {
  document.addEventListener('dragstart', e => e.preventDefault())
  document.addEventListener('selectstart', e => e.preventDefault())
  document.addEventListener('contextmenu', e => e.preventDefault())
  
  // 禁用Ctrl+滚轮缩放
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
    }
  }, { passive: false })
  
  // 禁用键盘缩放快捷键 Ctrl+Plus/Minus/0
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault()
    }
  })
})

const playerName = ref('阴阳师')
const inGame = ref(false)
const state = ref<GameState|null>(null)
let game: SinglePlayerGame|null = null
const logRef = ref<HTMLElement|null>(null)

// 选择相关状态
const showExiled = ref(false)
const selectingTarget = ref(false)
const selectingCards = ref(false)

// 悬浮提示状态
const tooltip = reactive<{
  show: boolean
  card: CardInstance | null
  x: number
  y: number
  typeLabel: string
  typeClass: string
  stats: Record<string, {icon: string, value: number | string}> | null
  effect: string
  passive: {name: string, effect: string} | null
  skill: {name: string, cost: number, effect: string} | null
}>({
  show: false,
  card: null,
  x: 0,
  y: 0,
  typeLabel: '',
  typeClass: '',
  stats: null,
  effect: '',
  passive: null,
  skill: null
})

// 效果选择弹窗
const choiceModal = reactive<{
  show: boolean
  options: string[]
  resolve: ((index: number) => void) | null
}>({
  show: false,
  options: [],
  resolve: null
})

// 卡牌选择弹窗
const cardSelectModal = reactive<{
  show: boolean
  title: string
  candidates: CardInstance[]
  count: number
  selected: string[]
  resolve: ((ids: string[]) => void) | null
}>({
  show: false,
  title: '选择卡牌',
  candidates: [],
  count: 1,
  selected: [],
  resolve: null
})

// 目标选择弹窗
const targetModal = reactive<{
  show: boolean
  candidates: CardInstance[]
  resolve: ((id: string) => void) | null
}>({
  show: false,
  candidates: [],
  resolve: null
})

// 式神获取/置换弹窗
const shikigamiModal = reactive<{
  show: boolean
  isReplace: boolean
  step: number  // 1=选卡, 2=选旧式神(仅置换), 3=选新式神
  selectedSpells: string[]
  selectedDamage: number
  oldShikigamiId: string
  candidates: any[]  // 抽到的式神
  selectingOld: boolean
}>({
  show: false,
  isReplace: false,
  step: 1,
  selectedSpells: [],
  selectedDamage: 0,
  oldShikigamiId: '',
  candidates: [],
  selectingOld: false
})

const player = computed(() => state.value?.players[0])
const yokai = computed(() => state.value?.field.yokaiSlots || [])
const boss = computed(() => state.value?.field.currentBoss)
const logs = computed(() => (state.value?.log || []).slice(-6))
const canSpell = computed(() => game?.canGainBasicSpell() ?? false)

// 式神获取/置换相关
const canAcquireShikigami = computed(() => game?.canAcquireShikigami() ?? false)
const canReplaceShikigami = computed(() => game?.canReplaceShikigami() ?? false)
const spellCardsInHand = computed(() => game?.getSpellCardsInHand() ?? [])

// 验证当前选择是否有效
const isValidShikigamiSelection = computed(() => {
  if (shikigamiModal.isReplace) {
    // 置换：必须选择恰好1张高级符咒（伤害=3）
    return shikigamiModal.selectedSpells.length === 1 && shikigamiModal.selectedDamage === 3
  } else {
    // 获取：必须≥5点，且包含高级符咒
    if (shikigamiModal.selectedDamage < 5) return false
    // 检查是否包含高级符咒
    const selectedCards = shikigamiModal.selectedSpells
      .map(id => player.value?.hand?.find(c => c.instanceId === id))
      .filter(c => c !== undefined)
    return selectedCards.some(c => (c?.damage || 1) === 3)
  }
})

// 活跃的临时Buff
const activeBuffs = computed(() => {
  const buffs: {type: string, label: string}[] = []
  const tempBuffs = player.value?.tempBuffs || []
  for (const b of tempBuffs) {
    if (b.type === 'SPELL_DAMAGE_BOOST') {
      buffs.push({ type: b.type, label: `⚔️+${b.value}(${b.remainingUses || b.remainingCount || '∞'})` })
    } else if (b.type === 'DOUBLE_YOKAI_EFFECT') {
      buffs.push({ type: b.type, label: '御魂x2' })
    } else if (b.type === 'KILL_TO_HAND') {
      buffs.push({ type: b.type, label: '退治→手牌' })
    } else if (b.type === 'COST_REDUCTION') {
      buffs.push({ type: b.type, label: `🔥-${b.value}` })
    }
  }
  return buffs
})

const phaseText = computed(() => {
  const p = state.value?.turnPhase
  if(p==='ghostFire') return '🔥鬼火'
  if(p==='shikigami') return '🦊式神'
  if(p==='action') return '⚔️行动'
  if(p==='cleanup') return '🧹清理'
  return ''
})

// 悬浮提示样式计算（带边缘碰撞检测）
const tooltipStyle = computed(() => {
  const tooltipWidth = 240  // 估算提示框宽度
  const tooltipHeight = 180 // 估算提示框高度
  const margin = 10         // 边缘安全距离
  
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let left = tooltip.x + 15
  let top = tooltip.y + 10
  
  // 右边缘碰撞：向左显示
  if (left + tooltipWidth > viewportWidth - margin) {
    left = tooltip.x - tooltipWidth - 15
  }
  
  // 下边缘碰撞：向上显示
  if (top + tooltipHeight > viewportHeight - margin) {
    top = tooltip.y - tooltipHeight - 10
  }
  
  // 左边缘碰撞：贴左边
  if (left < margin) {
    left = margin
  }
  
  // 上边缘碰撞：贴上边
  if (top < margin) {
    top = margin
  }
  
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

// 显示卡牌悬浮提示
function showTooltip(event: MouseEvent, card: CardInstance) {
  tooltip.card = card
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  // 根据卡牌类型设置不同信息
  const cardType = card.cardType || card.type
  
  if (cardType === 'spell') {
    tooltip.typeLabel = '阴阳术'
    tooltip.typeClass = 'type-spell'
    tooltip.stats = {
      damage: { icon: '⚔️', value: card.damage || 1 }
    }
    tooltip.effect = card.effect || `造成 ${card.damage || 1} 点伤害`
    tooltip.passive = null
    tooltip.skill = null
  } else if (cardType === 'yokai') {
    tooltip.typeLabel = '御魂'
    tooltip.typeClass = 'type-yokai'
    tooltip.stats = {
      hp: { icon: '❤️', value: card.hp || 0 },
      charm: { icon: '👑', value: card.charm || 0 }
    }
    tooltip.effect = card.effect || '无特殊效果'
    tooltip.passive = null
    tooltip.skill = null
  } else if (cardType === 'token') {
    tooltip.typeLabel = '令牌'
    tooltip.typeClass = 'type-token'
    tooltip.stats = {
      hp: { icon: '❤️', value: card.hp || 1 },
      charm: { icon: '👑', value: card.charm || 1 }
    }
    tooltip.effect = card.effect || '可用于超度'
    tooltip.passive = null
    tooltip.skill = null
  } else if (cardType === 'penalty') {
    tooltip.typeLabel = '恶评'
    tooltip.typeClass = 'type-penalty'
    tooltip.stats = {
      charm: { icon: '👑', value: card.charm || -1 }
    }
    tooltip.effect = card.effect || '负面声誉'
    tooltip.passive = null
    tooltip.skill = null
  } else {
    tooltip.typeLabel = cardType || '卡牌'
    tooltip.typeClass = ''
    tooltip.stats = null
    tooltip.effect = card.effect || ''
    tooltip.passive = null
    tooltip.skill = null
  }
  
  tooltip.show = true
}

// 显示式神悬浮提示
function showShikigamiTooltip(event: MouseEvent, shikigami: any) {
  tooltip.card = shikigami
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  tooltip.typeLabel = shikigami.rarity || 'SR'
  tooltip.typeClass = `rarity-${(shikigami.rarity || 'SR').toLowerCase()}`
  tooltip.stats = {
    charm: { icon: '👑', value: shikigami.charm || 2 }
  }
  
  // 只有被动时显示在effect区域，有主动时分开显示
  if (shikigami.passive && !shikigami.skill) {
    tooltip.effect = `【被动】${shikigami.passive.name}：${shikigami.passive.effect}`
    tooltip.passive = null
    tooltip.skill = null
  } else {
    tooltip.effect = ''
    tooltip.passive = shikigami.passive || null
    tooltip.skill = shikigami.skill || null
  }
  
  tooltip.show = true
}

// 显示鬼王悬浮提示
function showBossTooltip(event: MouseEvent, boss: any) {
  tooltip.card = boss
  tooltip.x = event.clientX
  tooltip.y = event.clientY
  
  tooltip.typeLabel = '鬼王'
  tooltip.typeClass = 'type-boss'
  tooltip.stats = {
    hp: { icon: '❤️', value: `${state.value?.field.bossCurrentHp || boss.hp}/${boss.hp}` },
    charm: { icon: '👑', value: boss.charm || 0 }
  }
  tooltip.effect = boss.arrivalEffect || boss.effect || '击败后获得声誉'
  tooltip.passive = null
  tooltip.skill = null
  
  tooltip.show = true
}

// 隐藏悬浮提示
function hideTooltip() {
  tooltip.show = false
}

function startGame() {
  game = new SinglePlayerGame(playerName.value||'阴阳师', s => {
    state.value = s
    nextTick(() => { if(logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight })
  })
  
  // 绑定选择回调
  game.onChoiceRequired = async (options: string[]) => {
    return new Promise<number>((resolve) => {
      choiceModal.show = true
      choiceModal.options = options
      choiceModal.resolve = resolve
    })
  }
  
  game.onSelectCardsRequired = async (candidates: CardInstance[], count: number) => {
    return new Promise<string[]>((resolve) => {
      cardSelectModal.show = true
      cardSelectModal.title = count > 1 ? `选择 ${count} 张牌` : '选择一张牌'
      cardSelectModal.candidates = candidates
      cardSelectModal.count = count
      cardSelectModal.selected = []
      cardSelectModal.resolve = resolve
    })
  }
  
  game.onSelectTargetRequired = async (candidates: CardInstance[]) => {
    return new Promise<string>((resolve) => {
      targetModal.show = true
      targetModal.candidates = candidates
      targetModal.resolve = resolve
    })
  }
  
  game.startGame()
  inGame.value = true
}

// 选择弹窗处理
function resolveChoice(index: number) {
  if (choiceModal.resolve) {
    choiceModal.resolve(index)
    choiceModal.show = false
    choiceModal.resolve = null
  }
}

function toggleCardSelect(id: string) {
  const idx = cardSelectModal.selected.indexOf(id)
  if (idx >= 0) {
    cardSelectModal.selected.splice(idx, 1)
  } else if (cardSelectModal.selected.length < cardSelectModal.count) {
    cardSelectModal.selected.push(id)
  }
}

function resolveCardSelect() {
  if (cardSelectModal.resolve && cardSelectModal.selected.length === cardSelectModal.count) {
    cardSelectModal.resolve([...cardSelectModal.selected])
    cardSelectModal.show = false
    cardSelectModal.resolve = null
  }
}

function resolveTarget(id: string) {
  if (targetModal.resolve) {
    targetModal.resolve(id)
    targetModal.show = false
    targetModal.resolve = null
  }
}

// 游戏操作
function handleCardClick(c: CardInstance) {
  if (selectingCards.value || cardSelectModal.show) return // 选择模式下不打牌
  game?.playCard(c.instanceId)
}

async function handleYokaiClick(i: number, y: CardInstance) {
  if (selectingTarget.value || targetModal.show) return // 选择模式下走弹窗
  
  // 检查妖怪是否已被击杀
  if (isKilled(y)) {
    // 已击杀：弹出退治/超度选择
    const choice = await new Promise<number>(resolve => {
      choiceModal.show = true
      choiceModal.options = [`退治【${y.name}】（放入弃牌堆）`, `超度【${y.name}】（移出游戏）`]
      choiceModal.resolve = resolve
    })
    
    if (choice === 0) {
      await game?.retireYokai(i)
    } else {
      game?.banishYokai(i)
    }
  } else {
    // 未击杀：分配伤害
    await game?.allocateDamage(i)
  }
}

function play(id: string) { game?.playCard(id) }
async function kill(i: number) { await game?.allocateDamage(i) }

// 妖怪状态辅助函数
function getYokaiCurrentHp(y: CardInstance): number {
  return y.currentHp !== undefined ? y.currentHp : y.hp
}
function isKilled(y: CardInstance): boolean {
  return y.currentHp !== undefined && y.currentHp <= 0
}
function isWounded(y: CardInstance): boolean {
  // 已受伤：当前HP < 最大HP
  const currentHp = getYokaiCurrentHp(y)
  return currentHp < y.hp && currentHp > 0
}
function canKillYokai(y: CardInstance): boolean {
  // 玩家伤害足以击杀该妖怪（伤害 >= 剩余HP）
  const currentHp = getYokaiCurrentHp(y)
  return (player.value?.damage || 0) >= currentHp && currentHp > 0
}
function canDamage(y: CardInstance): boolean {
  // 玩家有伤害且妖怪未被击杀
  return (player.value?.damage || 0) > 0 && !isKilled(y)
}
// 妖怪区是否全部清空（可攻击鬼王）
const allYokaiCleared = computed(() =>
  state.value?.field.yokaiSlots.every(s => s === null) ?? false
)
// 是否处于鬼王被击败等待选择状态
const isBossDefeated = computed(() =>
  (state.value?.turnPhase as any) === 'bossDefeated'
)
// 鬼王是否可以被攻击
const canAttackBoss = computed(() => {
  const p = player.value
  return state.value?.turnPhase === 'action'
    && !!state.value?.field.currentBoss
    && (p?.damage ?? 0) > 0
})

function hitBoss() {
  if (!canAttackBoss.value) return
  const d = player.value?.damage || 0
  if (d > 0) game?.attackBoss(d)
}
function useSkill(id: string) { game?.useShikigamiSkill(id) }
function getSpell() { game?.gainBasicSpell() }
function endTurn() { game?.endTurn() }
function refresh(b: boolean) { game?.decideYokaiRefresh(b) }
function confirmShiki() { game?.confirmShikigamiPhase() }
function cardType(c: CardInstance) { 
  return { 
    spell: c.cardType === 'spell', 
    yokai: c.cardType === 'yokai',
    token: c.cardType === 'token',
    penalty: c.cardType === 'penalty',
    boss: c.cardType === 'boss'
  } 
}

// 检查卡牌是否可以打出
function canPlay(c: CardInstance): boolean {
  if (!game) return false
  return game.canPlayCard(c).canPlay
}

// ========== 式神获取/置换相关函数 ==========

function openShikigamiModal() {
  const isReplace = canReplaceShikigami.value
  shikigamiModal.show = true
  shikigamiModal.isReplace = isReplace
  shikigamiModal.step = 1
  shikigamiModal.selectedSpells = []
  shikigamiModal.selectedDamage = 0
  shikigamiModal.oldShikigamiId = ''
  shikigamiModal.candidates = []
  shikigamiModal.selectingOld = false
}

function closeShikigamiModal() {
  shikigamiModal.show = false
  shikigamiModal.selectingOld = false
}

function toggleSpellForShikigami(card: CardInstance) {
  const idx = shikigamiModal.selectedSpells.indexOf(card.instanceId)
  if (idx >= 0) {
    shikigamiModal.selectedSpells.splice(idx, 1)
    shikigamiModal.selectedDamage -= (card.damage || card.hp || 1)
  } else {
    shikigamiModal.selectedSpells.push(card.instanceId)
    shikigamiModal.selectedDamage += (card.damage || card.hp || 1)
  }
}

async function nextShikigamiStep() {
  if (shikigamiModal.isReplace) {
    // 置换模式：进入步骤2选择旧式神
    shikigamiModal.step = 2
    shikigamiModal.selectingOld = true
  } else {
    // 获取模式：直接执行获取
    const success = await game?.acquireShikigami(shikigamiModal.selectedSpells)
    if (success) {
      closeShikigamiModal()
    }
  }
}

function selectOldShikigami(shikigamiId: string) {
  if (!shikigamiModal.selectingOld) return
  shikigamiModal.oldShikigamiId = shikigamiId
  shikigamiModal.selectingOld = false
  // 执行置换
  executeReplaceShikigami()
}

async function executeReplaceShikigami() {
  const success = await game?.replaceShikigami(
    shikigamiModal.selectedSpells, 
    shikigamiModal.oldShikigamiId
  )
  if (success) {
    closeShikigamiModal()
  }
}

async function selectNewShikigami(shikigami: any) {
  // 这个函数目前不会被调用，因为选择逻辑在game中处理
  // 保留以备将来扩展
  closeShikigamiModal()
}
</script>

<style scoped>
*{box-sizing:border-box}
.game-container{min-height:100vh;background:#1a1a2e;color:#fff;font-family:'Microsoft YaHei',sans-serif}

/* 大厅 */
.lobby{display:flex;justify-content:center;align-items:center;min-height:100vh}
.lobby-card{background:rgba(255,255,255,.1);padding:40px;border-radius:16px;text-align:center}
.lobby-card h1{font-size:32px;margin-bottom:10px}
.lobby-card h2{color:#888;margin-bottom:20px}
.name-input{width:100%;padding:10px;border-radius:8px;border:none;margin-bottom:15px}
.btn{padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-size:16px}
.btn.primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
.btn:disabled{opacity:.5;cursor:not-allowed}
.tips{margin-top:20px;color:#666;font-size:13px}

/* ══════════════════════════════════════════════
   游戏主布局 - 基于1920x1080设计稿
   使用min(宽度比例, 高度比例)确保完全适配视口
══════════════════════════════════════════════ */
.game-board{
  /* 取宽高中较小的缩放比例，确保内容不超出视口 */
  --sw: calc(100vw / 1920);  /* 基于宽度的缩放 */
  --sh: calc(100vh / 1080);  /* 基于高度的缩放 */
  --s: min(var(--sw), var(--sh));  /* 取较小值 */
  
  position:relative;
  width:calc(var(--s) * 1920);
  height:calc(var(--s) * 1080);
  background:#1A1A2E;
  font-family:'Segoe UI',sans-serif;
  overflow:hidden;
  touch-action:pan-x pan-y;
  user-select:none;
  
  /* 居中显示 */
  margin:0 auto;
}
/* 禁止滚轮缩放 */
.game-board *{
  touch-action:manipulation;
}

/* ══════════════════════════════════════════════
   顶部区域 - Figma精确坐标 (top: 0, height: 150px)
══════════════════════════════════════════════ */
.top-row{
  position:absolute;
  left:0;
  top:0;
  width:100%;
  height:calc(var(--s) * 150);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  padding:0 calc(var(--s) * 20);
}

.info-panel{
  display:none; /* 暂时隐藏，后续移到右侧信息区 */
}
.panel-title{
  font-size:calc(var(--s) * 24);
  color:#FFD700;
  letter-spacing:.05em;
  margin-bottom:calc(var(--s) * 8);
  font-weight:600;
  text-align:center;
}
.log-area{flex:1;overflow-y:auto;font-size:9px;line-height:1.5}
.log-line{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);color:#bbb}

/* 回合数显示 */
.turn-display{
  position:absolute;
  left:calc(var(--s) * 52);
  top:calc(var(--s) * 51);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  font-weight:bold;
}

/* 玩家信息槽 - 6个玩家位 */
.player-panel{
  position:absolute;
  left:calc(var(--s) * 180);
  top:calc(var(--s) * 15);
  display:flex;
  gap:calc(var(--s) * 25);
}
.player-info-slot{
  display:flex;
  gap:calc(var(--s) * 5);
}
.player-avatar{
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 120);
  background:#D9D9D9;
  display:flex;align-items:center;justify-content:center;
  font-size:calc(var(--s) * 32);
  color:#333;
}
.player-avatar.active{
  border:2px solid #FFD700;
  box-shadow:0 0 calc(var(--s) * 10) rgba(255,215,0,.5);
}
.player-stats{
  display:flex;flex-direction:column;gap:0;
}
.mini-stat{
  width:calc(var(--s) * 85);
  height:calc(var(--s) * 60);
  background:#151525;
  border:1px solid #D4A574;
  display:flex;align-items:center;justify-content:center;gap:calc(var(--s) * 5);
  font-size:calc(var(--s) * 24);
  color:#fff;
}
.mini-stat span{font-size:calc(var(--s) * 22)}

/* LOGO面板 - 右侧 "百鬼夜行" */
.logo-panel{
  position:absolute;
  right:calc(var(--s) * 20);
  top:calc(var(--s) * 17);
  text-align:center;
}
.logo{
  font-size:calc(var(--s) * 64);
  font-weight:bold;
  color:#fff;
  font-family:'Angkor',serif;
  letter-spacing:calc(var(--s) * 4);
}
.stats{
  margin-top:calc(var(--s) * 10);
  display:flex;flex-wrap:wrap;
  gap:calc(var(--s) * 8);
  justify-content:center;
  font-size:calc(var(--s) * 14);
}
.stats span{
  background:#151525;
  padding:calc(var(--s) * 4) calc(var(--s) * 8);
  border-radius:calc(var(--s) * 4);
  border:1px solid #D4A574;
}
.buffs{margin-top:calc(var(--s) * 6);display:flex;flex-wrap:wrap;gap:calc(var(--s) * 4);justify-content:center}
.buff-tag{
  background:linear-gradient(135deg,#ff9800,#e65100);
  padding:calc(var(--s) * 4) calc(var(--s) * 8);
  border-radius:calc(var(--s) * 4);
  font-size:calc(var(--s) * 12);
}

/* ══════════════════════════════════════════════
   中部区域 - Figma精确坐标 (top: 150px, height: 650px)
══════════════════════════════════════════════ */
.mid-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 150);
  width:100%;
  height:calc(var(--s) * 650);
  box-sizing:border-box;
  /* 不需要整体边框，各子区域有自己的边框 */
}

/* 鬼王区 - left:0, width:600px, height:490px */
.boss-panel{
  position:absolute;
  left:0;
  top:0;
  width:calc(var(--s) * 600);
  height:calc(var(--s) * 490);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;
  padding:calc(var(--s) * 20);
}
.boss-card{
  background:linear-gradient(160deg,#3a0a0a,#1a0520);
  border:2px solid #D4A574;
  border-radius:calc(var(--s) * 8);
  text-align:center;cursor:pointer;
  width:calc(var(--s) * 540);
  height:calc(var(--s) * 380);
  position:relative;overflow:hidden;
  transition:all .2s;
  box-shadow:0 calc(var(--s) * 4) calc(var(--s) * 16) rgba(180,0,50,.3);
}
.boss-card:hover{
  transform:scale(1.03);
  box-shadow:0 6px 24px rgba(220,50,80,.5);
  border-color:rgba(220,50,80,.8);
}
/* 可攻击状态 */
.boss-card.boss-attackable{
  border-color:rgba(255,80,80,.9);
  box-shadow:0 0 20px rgba(255,50,50,.7);
  animation:bossAttackPulse 1s infinite;
  cursor:pointer;
}
/* 妖怪全清提示状态 */
.boss-card.boss-hint{
  border-color:rgba(255,200,50,.6);
  box-shadow:0 0 12px rgba(255,200,50,.4);
}
/* 已击败等待选择 */
.boss-card.boss-defeated{
  border-color:rgba(150,150,150,.5);
  filter:grayscale(.4);
  cursor:default;
}
@keyframes bossAttackPulse{
  0%,100%{box-shadow:0 0 12px rgba(255,50,50,.5)}
  50%{box-shadow:0 0 28px rgba(255,50,50,.9)}
}
/* 攻击引导覆盖层 */
.boss-attack-overlay{
  position:absolute;inset:0;z-index:2;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:rgba(180,0,0,.55);
  font-size:12px;font-weight:bold;color:#fff;
  text-shadow:0 1px 4px rgba(0,0,0,.8);
  border-radius:inherit;
  pointer-events:none;
}
.boss-dmg-preview{
  font-size:18px;color:#ffcc00;
  text-shadow:0 0 8px rgba(255,200,0,.8);
}
/* 已击败覆盖层 */
.boss-defeated-overlay{
  position:absolute;inset:0;z-index:2;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:rgba(0,0,0,.65);
  font-size:11px;color:#aaa;
  border-radius:inherit;pointer-events:none;
}
/* 伤害不足时的提示 */
.boss-no-dmg-hint{
  margin-top:6px;
  font-size:9px;color:#ffcc66;
  text-align:center;
  line-height:1.4;
  background:rgba(0,0,0,.3);
  border-radius:4px;padding:3px 6px;
}
.boss-card-info{
  position:absolute;bottom:0;left:0;right:0;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,transparent 100%);
  padding:10px 5px 5px;
}
.boss-stage{font-size:8px;color:#ffc107;letter-spacing:.1em}
.boss-name{font-size:11px;font-weight:bold;color:#fff;margin:2px 0}
.boss-hp{font-size:10px;color:#ff6b6b}
.boss-charm{font-size:9px;color:#ffd700}
.boss-empty{color:#555;padding:12px;font-size:10px;text-align:center}
.boss-remain{
  color:#777;font-size:9px;
  background:rgba(0,0,0,.3);
  padding:2px 8px;border-radius:10px;
  border:1px solid rgba(255,255,255,.08);
}

/* 游荡妖怪区 - left:600px, width:750px */
.yokai-panel{
  position:absolute;
  left:calc(var(--s) * 600);
  top:0;
  width:calc(var(--s) * 750);
  height:calc(var(--s) * 650);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 15);
  overflow:hidden;
}

/* 游荡妖怪标签 */
.yokai-label{
  position:absolute;
  right:calc(var(--s) * -50);
  top:50%;
  transform:translateY(-50%);
  writing-mode:vertical-rl;
  font-size:calc(var(--s) * 36);
  color:#FFD700;
  letter-spacing:calc(var(--s) * 8);
}

/* 右侧信息区 - left:1350px, width:570px, height:650px (填满中部区域) */
.info-side-panel{
  position:absolute;
  left:calc(var(--s) * 1350);
  top:0;
  width:calc(var(--s) * 570);
  height:calc(var(--s) * 650);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  overflow:hidden;
}
.info-box{
  flex:1;
  background:#1A1A2E;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 10);
  overflow-y:auto;
  overflow-x:hidden;
  display:flex;flex-direction:column;gap:calc(var(--s) * 6);
}
.info-line{
  background:#2D1F3D;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 8) calc(var(--s) * 12);
  font-size:calc(var(--s) * 20);
  color:#fff;
  min-height:calc(var(--s) * 48);
  display:flex;align-items:center;
  word-break:break-all;
  line-height:1.4;
  flex-shrink:0;
}
.action-buttons{
  display:flex;
  gap:calc(var(--s) * 20);
  padding:calc(var(--s) * 15) 0;
  justify-content:center;
  margin-top:auto;
}
.side-btn{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 100);
  background:#1A1A2E;
  border:2px solid #D4A574;
  color:#fff;
  font-size:calc(var(--s) * 22);
  cursor:pointer;
  transition:all .2s;
  border-radius:calc(var(--s) * 4);
}
.side-btn:hover:not(:disabled){background:#2D1F3D}
.side-btn:disabled{opacity:.4;cursor:not-allowed}

/* ══════════════════════════════════════════════
   个人信息区 - top:640px, height:160px
══════════════════════════════════════════════ */
.personal-info-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 640);
  width:calc(var(--s) * 600);
  height:calc(var(--s) * 160);
  display:flex;
}
.self-info{
  width:calc(var(--s) * 245);
  height:100%;
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  padding:calc(var(--s) * 10);
  gap:calc(var(--s) * 10);
}
.avatar-box{
  width:calc(var(--s) * 120);
  height:calc(var(--s) * 120);
  border:1px solid #D4A574;
  background:#1A1A2E;
}
.stat-box{
  flex:1;
  display:flex;flex-direction:column;gap:calc(var(--s) * 5);
}
.stat-item{
  background:#151525;
  border:1px solid #D4A574;
  padding:calc(var(--s) * 8);
  display:flex;align-items:center;gap:calc(var(--s) * 8);
  font-size:calc(var(--s) * 20);
}
.stat-item span{font-size:calc(var(--s) * 24)}
.stat-item b{color:#fff}

.deck-discard-area{
  width:calc(var(--s) * 360);
  height:100%;
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;
  gap:calc(var(--s) * 20);
  padding:calc(var(--s) * 18);
  justify-content:center;
}
.pile-box{
  width:calc(var(--s) * 150);
  height:calc(var(--s) * 120);
  background:#1A1A2E;
  border:2px solid #D4A574;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.pile-box b{font-size:calc(var(--s) * 40);color:#fff}
.pile-box span{font-size:calc(var(--s) * 24);color:#aaa}

/* 3列x2行 妖怪网格 */
.yokai-grid{
  display:grid;
  grid-template-columns:repeat(3, calc(var(--s) * 180));
  grid-template-rows:repeat(2, calc(var(--s) * 250));
  gap:calc(var(--s) * 15);
  justify-content:center;
  align-content:center;
  flex:1;
}
.yokai-card{
  width:calc(var(--s) * 180);
  height:calc(var(--s) * 250);
  background:#1A1A2E;
  border:1px solid #D4A574;
  border-radius:calc(var(--s) * 4);
  cursor:pointer;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  transition:all .18s;
  box-sizing:border-box;
}
.yokai-card:hover:not(.empty){
  border-color:rgba(120,160,255,.6);
  box-shadow:0 4px 16px rgba(80,120,255,.3);
  transform:translateY(-2px);
}
.yokai-card.empty{
  background:rgba(30,50,90,.15);
  border-color:rgba(80,120,200,.08);
  cursor:default;
}
.yokai-card.wounded{border-color:#ff6b6b;box-shadow:0 0 8px rgba(255,80,80,.3)}
.yokai-card.canKill{border-color:#4CAF50;box-shadow:0 0 12px rgba(76,175,80,.7);animation:canKillPulse 1.2s infinite}
.yokai-card.killed{border-color:#e91e63;box-shadow:0 0 10px rgba(233,30,99,.5)}
.yokai-card.selecting{border-color:#ff9800;animation:pulse 1s infinite}

/* 妖怪卡片底部信息条 */
.yokai-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,.4) 70%,transparent 100%);
  padding:calc(var(--s) * 18) calc(var(--s) * 8) calc(var(--s) * 8);
}
.y-name{
  font-size:calc(var(--s) * 16);
  font-weight:700;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:#f0e6d3;text-shadow:0 1px 4px rgba(0,0,0,.8);
  text-align:center;
}
.y-stat{
  font-size:calc(var(--s) * 14);
  color:#ccc;
  margin-top:calc(var(--s) * 4);
  display:flex;gap:calc(var(--s) * 8);justify-content:center;
}
.hp-damaged{color:#ff6b6b;font-weight:bold}
.killed-badge{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  background:rgba(0,0,0,.9);
  padding:calc(var(--s) * 8) calc(var(--s) * 16);
  border-radius:calc(var(--s) * 6);
  font-size:calc(var(--s) * 16);
  color:#e91e63;
  white-space:nowrap;font-weight:bold;
  border:1px solid rgba(233,30,99,.5);
  z-index:2;
}
@keyframes canKillPulse{
  0%,100%{box-shadow:0 0 6px rgba(76,175,80,.4)}
  50%{box-shadow:0 0 16px rgba(76,175,80,.9)}
}

.action-bar{
  display:flex;gap:5px;align-items:center;
  padding-top:5px;
  border-top:1px solid rgba(255,255,255,.08);
  margin-top:auto;flex-shrink:0;
}
.deck-num,.exile-num{
  background:rgba(0,0,0,.4);
  border:1px solid rgba(255,255,255,.1);
  padding:4px 8px;border-radius:4px;font-size:10px;
  color:#aaa;min-width:28px;text-align:center;
}
.act-btn{
  flex:1;padding:5px;
  background:rgba(80,120,200,.2);
  border:1px solid rgba(80,120,200,.4);
  border-radius:5px;color:#b0c4de;
  cursor:pointer;font-size:10px;
  transition:all .15s;
}
.act-btn:hover:not(:disabled){
  background:rgba(80,120,200,.4);
  color:#fff;border-color:rgba(100,160,255,.6);
}
.act-btn:disabled{opacity:.35;cursor:not-allowed}

/* ══════════════════════════════════════════════
   底部区域 - Figma精确坐标 (top: 800px)
══════════════════════════════════════════════ */
.bot-row{
  position:absolute;
  left:0;
  top:calc(var(--s) * 800);
  width:100%;
  height:calc(var(--s) * 280);
  display:flex;
  z-index:10;
}

/* 式神区 - left:0, width:450px */
.shiki-panel{
  position:absolute;
  left:0;
  top:0;
  width:calc(var(--s) * 450);
  height:calc(var(--s) * 280);
  background:#151525;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;
  padding:calc(var(--s) * 10);
  align-items:center;
}
.shiki-label{
  position:absolute;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  pointer-events:none;
  opacity:.3;
}
.shiki-cards{
  display:flex;
  gap:calc(var(--s) * 10);
  padding:calc(var(--s) * 10);
}
.ghost-fire-bar{
  display:flex;
  gap:calc(var(--s) * 5);
  margin-top:auto;
  padding-bottom:calc(var(--s) * 10);
}
.fire-slot{
  width:calc(var(--s) * 40);
  height:calc(var(--s) * 40);
  background:#333;
  border-radius:50%;
  border:1px solid #D4A574;
}
.fire-slot.active{
  background:linear-gradient(135deg,#ff6b35,#f7931e);
  box-shadow:0 0 calc(var(--s) * 10) rgba(255,107,53,.6);
}
.shiki-card{
  width:calc(var(--s) * 135);
  height:calc(var(--s) * 192);
  background:#1A1A2E;
  border:1px solid #D4A574;
  border-radius:calc(var(--s) * 4);
  cursor:pointer;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  transition:all .18s;
}
.shiki-card:hover:not(.tired){
  border-color:#FFD700;
  box-shadow:0 0 calc(var(--s) * 12) rgba(255,215,0,.4);
  transform:translateY(calc(var(--s) * -4));
}
.shiki-card.tired{opacity:.35;filter:grayscale(.8)}

/* 式神卡底部信息 */
.shiki-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.4) 70%,transparent 100%);
  padding:calc(var(--s) * 14) calc(var(--s) * 6) calc(var(--s) * 6);
}
.s-name{
  font-size:calc(var(--s) * 14);
  font-weight:700;
  color:#f5e0c0;
  text-shadow:0 1px 3px rgba(0,0,0,.8);
  text-align:center;
}
.s-skill{
  font-size:calc(var(--s) * 11);
  color:#c8a96e;
  margin-top:calc(var(--s) * 3);
  line-height:1.3;
  text-align:center;
}

/* 牌库面板 - 移入式神区内部 */
.pile-panel{
  position:absolute;
  right:calc(var(--s) * 10);
  bottom:calc(var(--s) * 10);
  display:flex;flex-direction:column;gap:calc(var(--s) * 5);
}
.pile{
  width:calc(var(--s) * 80);
  height:calc(var(--s) * 50);
  background:#151525;
  border:1px solid #D4A574;
  border-radius:4px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
}
.pile span{font-size:calc(var(--s) * 14);color:#aaa}
.pile b{font-size:calc(var(--s) * 20);color:#fff;font-weight:600}

/* 手牌区 - left:450px, width:1175px */
.hand-panel{
  position:absolute;
  left:calc(var(--s) * 450);
  top:0;
  width:calc(var(--s) * 1175);
  height:calc(var(--s) * 280);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  padding:calc(var(--s) * 10);
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.damage-display{
  position:absolute;
  left:calc(var(--s) * 10);
  top:calc(var(--s) * 10);
  width:calc(var(--s) * 100);
  height:calc(var(--s) * 70);
  background:#151525;
  border:1px solid #D4A574;
  display:flex;align-items:center;justify-content:center;gap:calc(var(--s) * 8);
  font-size:calc(var(--s) * 28);
}
.damage-display b{color:#fff;font-size:calc(var(--s) * 32)}
.hand-label{
  position:absolute;
  top:50%;left:50%;
  transform:translate(-50%,-50%);
  font-size:calc(var(--s) * 42);
  color:#FFD700;
  pointer-events:none;
  opacity:0.3;
}
.hand-cards{
  display:flex;
  gap:calc(var(--s) * 10);
  overflow-x:auto;
  flex:1;
  align-items:center;
  justify-content:center;
  padding:calc(var(--s) * 10);
}
.hand-cards::-webkit-scrollbar{height:3px}
.hand-cards::-webkit-scrollbar-track{background:transparent}
.hand-cards::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px}

.hand-card{
  width:calc(var(--s) * 100);
  height:calc(var(--s) * 140);
  border-radius:calc(var(--s) * 6);
  text-align:center;cursor:pointer;flex-shrink:0;
  transition:all .18s;
  display:flex;flex-direction:column;justify-content:flex-end;
  position:relative;overflow:hidden;
  border:1px solid #D4A574;
  box-shadow:0 calc(var(--s) * 2) calc(var(--s) * 8) rgba(0,0,0,.4);
}
.hand-card:hover:not(.unplayable){
  transform:translateY(-6px);
  box-shadow:0 8px 20px rgba(0,0,0,.5);
  border-color:rgba(255,255,255,.4);
  z-index:2;
}
.hand-card.spell{background:linear-gradient(160deg,#0d2b5e,#1565C0)}
.hand-card.yokai{background:linear-gradient(160deg,#0a2a14,#1b5e20)}
.hand-card.token{background:linear-gradient(160deg,#3e2000,#e65100)}
.hand-card.penalty{background:linear-gradient(160deg,#1a1a2e,#37474f)}
.hand-card.boss{background:linear-gradient(160deg,#2a0030,#6a1b9a)}
.hand-card.unplayable{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
.hand-card.unplayable:hover{transform:none;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.hand-card.selecting{border:2px solid #ff9800;box-shadow:0 0 10px rgba(255,152,0,.5)}

/* 手牌底部信息条 */
.card-info{
  position:relative;z-index:1;
  background:linear-gradient(0deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.5) 70%,transparent 100%);
  padding:calc(var(--s) * 16) calc(var(--s) * 6) calc(var(--s) * 6);
}
.c-name{
  font-size:calc(var(--s) * 14);
  font-weight:700;
  color:#f0e6d3;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  text-align:center;
}
.c-stat{
  font-size:calc(var(--s) * 14);
  color:#ddd;
  margin-top:calc(var(--s) * 3);
  text-align:center;
}

/* 回合结束区 - left:1625px, width:295px */
.end-panel{
  position:absolute;
  left:calc(var(--s) * 1625);
  top:0;
  width:calc(var(--s) * 295);
  height:calc(var(--s) * 280);
  background:#2D1F3D;
  border:2px solid #D4A574;
  box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--s) * 10);
}
.end-btn{
  width:calc(var(--s) * 221);
  height:calc(var(--s) * 198);
  background:#539D9D;
  border:2px solid #D4A574;
  border-radius:calc(var(--s) * 8);
  color:#fff;
  font-size:calc(var(--s) * 32);
  cursor:pointer;font-weight:bold;
  transition:all .18s;
}
.end-btn:hover:not(:disabled){
  background:#5DB5B5;
  box-shadow:0 0 calc(var(--s) * 20) rgba(83,157,157,.6);
}
.end-btn:disabled{opacity:.4;cursor:not-allowed}
.phase{font-size:calc(var(--s) * 16);color:#aaa;text-align:center}

/* 弹窗 - 适配1024x768 */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100}
.modal-box{background:#2d2d44;padding:16px;border-radius:8px;text-align:center;min-width:240px;max-width:400px}
.modal-title{font-size:14px;font-weight:bold;margin-bottom:10px}
.modal-hint{font-size:11px;color:#aaa;margin-bottom:8px}
.modal-actions{margin-top:10px}

/* 效果选择弹窗 */
.choice-modal{min-width:260px}
.choice-options{display:flex;flex-direction:column;gap:8px}
.choice-btn{padding:10px 14px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;transition:all .15s}
.choice-btn:hover{transform:scale(1.02);box-shadow:0 3px 12px rgba(102,126,234,.4)}

/* 卡牌选择弹窗 */
.card-select-modal{min-width:300px}
.card-select-grid{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-height:200px;overflow-y:auto;padding:8px}
.select-card{width:60px;padding:8px 5px;background:rgba(100,150,200,.3);border-radius:5px;text-align:center;cursor:pointer;transition:all .15s;border:2px solid transparent}
.select-card:hover{background:rgba(100,150,200,.5)}
.select-card.selected{border-color:#4CAF50;background:rgba(76,175,80,.3)}
.select-card .c-name{font-size:9px;font-weight:bold}
.select-card .c-stat{font-size:9px;color:#ccc;margin-top:2px}

/* 目标选择弹窗 */
.target-modal{min-width:280px}
.target-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.target-card{width:70px;padding:10px 6px;background:linear-gradient(135deg,#ff5722,#e64a19);border-radius:5px;text-align:center;cursor:pointer;transition:all .15s}
.target-card:hover{transform:scale(1.03)}
.target-card .c-name{font-size:10px;font-weight:bold}
.target-card .c-stat{font-size:9px;margin-top:2px}

/* 超度区弹窗 */
.exiled-modal{min-width:240px}
.exiled-cards{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0}
.exiled-card{padding:5px 8px;background:rgba(100,100,100,.3);border-radius:4px;font-size:10px}
.empty-hint{color:#888;margin:12px 0;font-size:11px}

/* 式神获取/置换弹窗 */
.shikigami-modal{min-width:320px;max-width:400px}
.shikigami-step{padding:8px 0}
.step-hint{font-size:12px;color:#aaa;margin-bottom:8px}
.step-info{font-size:14px;font-weight:bold;color:#4CAF50;margin-bottom:12px}
.spell-select-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-height:160px;overflow-y:auto;padding:8px}
.spell-card{width:65px;padding:10px 6px;background:linear-gradient(135deg,#2196F3,#1976D2);border-radius:6px;text-align:center;cursor:pointer;transition:all .15s;border:2px solid transparent}
.spell-card:hover{transform:scale(1.03);box-shadow:0 2px 8px rgba(33,150,243,.4)}
.spell-card.selected{border-color:#4CAF50;box-shadow:0 0 12px rgba(76,175,80,.5)}
.spell-card .c-name{font-size:9px;font-weight:bold}
.spell-card .c-stat{font-size:11px;margin-top:3px}

.old-shiki-grid{display:flex;gap:10px;justify-content:center}
.old-shiki-card{width:80px;padding:12px 8px;background:linear-gradient(135deg,#ff9800,#f57c00);border-radius:6px;text-align:center;cursor:pointer;transition:all .15s}
.old-shiki-card:hover{transform:scale(1.05);box-shadow:0 3px 12px rgba(255,152,0,.5)}

.new-shiki-grid{display:flex;gap:10px;justify-content:center}
.new-shiki-card{width:90px;padding:12px 8px;background:linear-gradient(135deg,#9c27b0,#7b1fa2);border-radius:6px;text-align:center;cursor:pointer;transition:all .15s}
.new-shiki-card:hover{transform:scale(1.05);box-shadow:0 3px 12px rgba(156,39,176,.5)}
.new-shiki-card .s-name{font-size:11px;font-weight:bold;margin-bottom:4px}
.new-shiki-card .s-rarity{font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.3)}
.new-shiki-card .s-rarity.rarity-ssr{color:#FFD700}
.new-shiki-card .s-rarity.rarity-sr{color:#C0C0C0}
.new-shiki-card .s-rarity.rarity-r{color:#CD7F32}
.new-shiki-card .s-charm{font-size:10px;margin-top:4px}

/* 式神区按钮 */
.panel-title{display:flex;align-items:center;justify-content:space-between;padding:0 2px}
.shiki-btn{padding:2px 6px;font-size:9px;background:linear-gradient(135deg,#ff9800,#f57c00);border:none;border-radius:3px;color:#fff;cursor:pointer}
.shiki-btn:hover{transform:scale(1.05)}
.shiki-card.selecting{border:2px dashed #ff9800;animation:pulse 1s infinite}

@keyframes pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(255,152,0,.4)}
  50%{box-shadow:0 0 0 8px rgba(255,152,0,0)}
}

/* ── 卡牌图片通用样式 ── */
.card-art{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:top center;
  opacity:.55;border-radius:inherit;pointer-events:none;
  z-index:0;
}
.boss-art{object-position:center center;opacity:.6}
/* 文字层在图片上方 */
.boss-card > *:not(.card-art),
.yokai-card > *:not(.card-art),
.shiki-card > *:not(.card-art),
.hand-card > *:not(.card-art){position:relative;z-index:1}
</style>

<style>
/* 卡牌悬浮提示 - 全局样式（不使用scoped，因为Teleport到body） */
.card-tooltip{
  position:fixed;
  z-index:9999;
  background:linear-gradient(135deg,#2d2d44 0%,#1a1a2e 100%);
  border:2px solid #D4A574;
  border-radius:12px;
  padding:16px 20px;
  min-width:280px;
  max-width:360px;
  box-shadow:0 8px 32px rgba(0,0,0,.6);
  pointer-events:none;
  animation:tooltipIn .12s ease-out;
  font-family:'Microsoft YaHei',sans-serif;
  color:#fff;
}

@keyframes tooltipIn{
  from{opacity:0;transform:translateY(5px)}
  to{opacity:1;transform:translateY(0)}
}

.tooltip-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:10px;
  padding-bottom:10px;
  border-bottom:1px solid rgba(255,255,255,.2);
}

.tooltip-name{
  font-size:18px;
  font-weight:bold;
}

.tooltip-type{
  font-size:12px;
  padding:4px 10px;
  border-radius:4px;
  background:rgba(100,100,100,.5);
}

.tooltip-type.type-spell{
  background:linear-gradient(135deg,#2196F3,#1976D2);
}

.tooltip-type.type-yokai{
  background:linear-gradient(135deg,#4CAF50,#388E3C);
}

.tooltip-type.type-token{
  background:linear-gradient(135deg,#ff9800,#f57c00);
}

.tooltip-type.type-penalty{
  background:linear-gradient(135deg,#f44336,#d32f2f);
}

.tooltip-type.type-boss{
  background:linear-gradient(135deg,#b71c1c,#880e4f);
}

.tooltip-type.rarity-ssr{
  background:linear-gradient(135deg,#ffd700,#ff8c00);
  color:#000;
}

.tooltip-type.rarity-sr{
  background:linear-gradient(135deg,#9c27b0,#7b1fa2);
}

.tooltip-type.rarity-r{
  background:linear-gradient(135deg,#2196F3,#1976D2);
}

.tooltip-stats{
  display:flex;
  gap:12px;
  margin-bottom:10px;
}

.stat-item{
  font-size:14px;
  background:rgba(255,255,255,.1);
  padding:5px 10px;
  border-radius:4px;
}

.tooltip-subtype{
  font-size:13px;
  color:#aaa;
  margin-bottom:8px;
  font-style:italic;
}

.tooltip-effect{
  font-size:14px;
  line-height:1.5;
  color:#e0e0e0;
  padding:10px;
  background:rgba(0,0,0,.2);
  border-radius:6px;
  border-left:3px solid #667eea;
}

.tooltip-passive,.tooltip-skill{
  margin-top:10px;
  padding:10px;
  background:rgba(0,0,0,.2);
  border-radius:6px;
}

.tooltip-passive{
  border-left:3px solid #4CAF50;
}

.tooltip-skill{
  border-left:3px solid #ff9800;
}

.passive-label,.skill-label{
  display:block;
  font-size:13px;
  font-weight:bold;
  margin-bottom:5px;
}

.passive-label{color:#4CAF50}
.skill-label{color:#ff9800}

.tooltip-passive p,.tooltip-skill p{
  margin:0;
  font-size:13px;
  color:#ccc;
  line-height:1.4;
}
</style>
