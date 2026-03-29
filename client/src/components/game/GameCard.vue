<template>
  <div
    :class="cardClasses"
    :style="cardStyle"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 立绘区 -->
    <div class="card-art">
      <img
        v-if="cardData.image"
        :src="cardData.image"
        :alt="cardData.name"
        class="card-image"
      />
      <div v-else class="card-placeholder">{{ cardEmoji }}</div>
    </div>
    
    <!-- 信息栏 -->
    <div class="card-info">
      <div class="card-name">{{ cardData.name }}</div>
      <div class="card-stats" v-if="showStats">
        <template v-if="cardData.hp">
          <span :class="hpClass">❤️{{ currentHp }}/{{ cardData.hp }}</span>
        </template>
        <template v-if="cardData.damage">
          <span>⚔️{{ cardData.damage }}</span>
        </template>
      </div>
    </div>
    
    <!-- 状态徽章 -->
    <div v-if="cardData.killed" class="killed-badge">
      💀 已击杀
    </div>
    
    <!-- 可击杀提示 -->
    <div v-if="cardData.canKill" class="can-kill-badge">
      ✓ 可击杀
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface CardData {
  id: string
  name: string
  type: 'yokai' | 'shikigami' | 'spell' | 'token' | 'penalty' | 'boss'
  image?: string
  hp?: number
  damage?: number
  currentHp?: number
  wounded?: boolean
  canKill?: boolean
  killed?: boolean
  unplayable?: boolean
}

interface Props {
  cardData: CardData
  showStats?: boolean
  width?: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true,
  width: '100px',
  height: '140px'
})

const emit = defineEmits<{
  click: [cardData: CardData]
  mouseenter: [cardData: CardData]
  mouseleave: [cardData: CardData]
}>()

const currentHp = computed(() => {
  return props.cardData.currentHp ?? props.cardData.hp
})

const hpClass = computed(() => {
  if (props.cardData.killed) return 'hp-killed'
  if (props.cardData.wounded) return 'hp-damaged'
  return 'hp-normal'
})

const cardClasses = computed(() => [
  'card',
  `card--${props.cardData.type}`,
  {
    'card--wounded': props.cardData.wounded,
    'card--can-kill': props.cardData.canKill,
    'card--killed': props.cardData.killed,
    'card--unplayable': props.cardData.unplayable
  }
])

const cardStyle = computed(() => ({
  width: props.width,
  height: props.height
}))

const cardEmoji = computed(() => {
  const emojiMap: Record<string, string> = {
    yokai: '👹',
    shikigami: '🎭',
    spell: '⚡',
    token: '🎴',
    penalty: '👨‍🌾',
    boss: '👺'
  }
  return emojiMap[props.cardData.type] || '🎴'
})

const handleClick = () => {
  emit('click', props.cardData)
}

const handleMouseEnter = () => {
  emit('mouseenter', props.cardData)
}

const handleMouseLeave = () => {
  emit('mouseleave', props.cardData)
}
</script>

<style scoped>
.card {
  position: relative;
  border-radius: var(--radius-sm);
  border: 2px solid var(--gold-border);
  background: linear-gradient(145deg, rgba(45, 31, 61, 0.9), rgba(26, 26, 46, 0.95));
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: all var(--transition-base);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  border: 1px solid rgba(212, 165, 116, 0.3);
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.card:hover:not(.card--unplayable):not(.card--killed) {
  transform: translateY(-3px);
  box-shadow: var(--shadow-gold-md);
}

/* 卡牌类型 */
.card--yokai {
  background: var(--card-yokai-bg);
  border-color: var(--card-yokai-border);
}

.card--shikigami {
  background: linear-gradient(145deg, rgba(150, 100, 50, 0.4), rgba(100, 60, 30, 0.5));
}

.card--spell {
  background: var(--card-spell-bg);
  border-color: var(--card-spell-border);
}

.card--token {
  background: var(--card-token-bg);
  border-color: var(--card-token-border);
}

.card--penalty {
  background: var(--card-penalty-bg);
  border-color: var(--card-penalty-border);
}

.card--boss {
  background: var(--card-boss-bg);
  border-color: var(--card-boss-border);
  border-width: 3px;
  border-radius: var(--radius-md);
}

/* 状态变体 */
.card--wounded {
  border-color: var(--damage-red);
  background: linear-gradient(145deg, rgba(255, 107, 107, 0.15), rgba(45, 31, 61, 0.9));
}

.card--can-kill {
  border-color: var(--life-green);
  box-shadow: 0 0 15px rgba(129, 199, 132, 0.5);
  animation: canKillGlow 1.5s ease-in-out infinite;
}

@keyframes canKillGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(129, 199, 132, 0.4); }
  50% { box-shadow: 0 0 20px rgba(129, 199, 132, 0.7); }
}

.card--killed {
  border-color: #e91e63;
  background: linear-gradient(145deg, rgba(233, 30, 99, 0.2), rgba(45, 31, 61, 0.9));
  cursor: default;
}

.card--unplayable {
  opacity: 0.6;
  cursor: not-allowed;
}

.card--unplayable:hover {
  transform: none;
  box-shadow: none;
}

/* 立绘区 */
.card-art {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(50, 50, 50, 0.5));
  overflow: hidden;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-placeholder {
  font-size: 48px;
  user-select: none;
}

/* 信息栏 */
.card-info {
  padding: var(--space-sm);
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
}

.card-name {
  font-size: var(--font-size-md);
  font-weight: bold;
  color: var(--gold-border);
  margin-bottom: var(--space-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-stats {
  font-size: var(--font-size-base);
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

/* HP状态 */
.hp-normal {
  color: #fff;
}

.hp-damaged {
  color: var(--damage-red);
  font-weight: bold;
}

.hp-killed {
  color: #e91e63;
  font-weight: bold;
}

/* 徽章 */
.killed-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #e91e63;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  color: #e91e63;
  font-weight: bold;
  white-space: nowrap;
  z-index: 10;
}

.can-kill-badge {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  background: var(--life-green);
  color: var(--bg-primary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: bold;
  z-index: 10;
}
</style>
