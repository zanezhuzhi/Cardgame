<template>
  <div class="pending-choice-shell" :class="{ 'pcs-bare': !showChrome }">
    <div v-if="showChrome" class="pcs-header">
      <div class="pcs-source">
        <div v-if="sourceImageUrl" class="pcs-thumb-wrap">
          <img :src="sourceImageUrl" alt="" class="pcs-thumb" />
        </div>
        <div v-else class="pcs-thumb-placeholder">{{ sourcePlaceholderChar }}</div>
        <div class="pcs-source-text">
          <span class="pcs-source-label">来源</span>
          <span class="pcs-source-name">{{ displaySourceName }}</span>
        </div>
      </div>
      <div class="pcs-right-col">
        <div class="pcs-effect-block">
          <div class="pcs-block-label">当前步骤</div>
          <p class="pcs-step-summary">{{ stepSummary || '请按提示完成选择' }}</p>
          <button
            v-if="fullRulesText && fullRulesText !== '（暂无完整规则文本）'"
            type="button"
            class="pcs-expand-btn"
            @click="expanded = !expanded"
          >
            {{ expanded ? '收起完整规则' : '展开完整规则' }}
          </button>
          <div v-if="expanded" class="pcs-full-rules">{{ fullRulesText }}</div>
        </div>
        <div v-if="showTimer" class="pcs-timer-block">
          <div class="pcs-block-label">
            {{ timerMode === 'offTurnResponse' ? '本段响应' : '回合计时' }}
          </div>
          <div class="pcs-timer-bar-outer">
            <div
              class="pcs-timer-bar-inner"
              :style="{ width: timerBarPercent + '%' }"
            />
          </div>
          <div class="pcs-timer-caption">{{ timerCaption }}</div>
        </div>
      </div>
    </div>
    <div class="pcs-body" :class="{ 'pcs-body-standalone': !showChrome }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    stepSummary: string
    fullRulesText: string
    sourceLabel?: string
    sourceCardName?: string
    sourceImageUrl?: string
    timerMode: 'turnTotal' | 'offTurnResponse'
    turnCountdownSec: number
    turnCountdownMaxSec: number
    offTurnDeadlineAt?: number | null
    /** 多人行动阶段是否显示右下计时 */
    showTimer?: boolean
    /** false 时仅渲染插槽（无来源/说明/计时条） */
    showChrome?: boolean
  }>(),
  {
    sourceLabel: '',
    sourceCardName: '',
    sourceImageUrl: '',
    offTurnDeadlineAt: null,
    showTimer: true,
    showChrome: true,
  }
)

const expanded = ref(false)
const offTurnRemainSec = ref(0)
let offIv: ReturnType<typeof setInterval> | null = null

function tickOffTurn() {
  const d = props.offTurnDeadlineAt
  if (!d) {
    offTurnRemainSec.value = 0
    return
  }
  offTurnRemainSec.value = Math.max(0, Math.ceil((d - Date.now()) / 1000))
}

watch(
  () => [props.offTurnDeadlineAt, props.timerMode] as const,
  () => {
    if (offIv) {
      clearInterval(offIv)
      offIv = null
    }
    if (props.timerMode !== 'offTurnResponse' || !props.showTimer) return
    tickOffTurn()
    offIv = setInterval(tickOffTurn, 250)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (offIv) clearInterval(offIv)
})

const displaySourceName = computed(() => {
  if (props.sourceCardName) return props.sourceCardName
  if (props.sourceLabel) return props.sourceLabel
  return '效果'
})

const sourcePlaceholderChar = computed(() =>
  displaySourceName.value ? displaySourceName.value.charAt(0) : '?'
)

const timerBarPercent = computed(() => {
  if (!props.showTimer) return 0
  if (props.timerMode === 'offTurnResponse') {
    return Math.min(100, (offTurnRemainSec.value / 5) * 100)
  }
  const max = props.turnCountdownMaxSec
  if (max <= 0) return 100
  return Math.min(100, (props.turnCountdownSec / max) * 100)
})

const timerCaption = computed(() => {
  if (!props.showTimer) return ''
  if (props.timerMode === 'offTurnResponse') {
    return `${offTurnRemainSec.value}s / 5s`
  }
  if (props.turnCountdownMaxSec <= 0) return '无限制'
  return `${Math.max(0, props.turnCountdownSec)}s / ${props.turnCountdownMaxSec}s`
})
</script>

<style scoped>
.pending-choice-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(96vw, 720px);
  margin: 0 auto;
}
.pcs-header {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  padding: 12px;
  background: rgba(26, 26, 46, 0.92);
  border: 1px solid #d4a574;
  border-radius: 10px;
  color: #e8e6f0;
}
.pcs-source {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.pcs-thumb-wrap {
  width: 72px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(212, 165, 116, 0.5);
}
.pcs-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pcs-thumb-placeholder {
  width: 72px;
  height: 100px;
  border-radius: 6px;
  border: 1px dashed rgba(212, 165, 116, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #ffd700;
}
.pcs-source-label {
  display: block;
  font-size: 10px;
  color: #9e9bb8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.pcs-source-name {
  font-size: 13px;
  font-weight: 600;
  color: #ffd700;
  line-height: 1.25;
}
.pcs-right-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.pcs-effect-block {
  flex: 1;
  min-width: 0;
}
.pcs-block-label {
  font-size: 10px;
  color: #9e9bb8;
  margin-bottom: 4px;
}
.pcs-step-summary {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.45;
}
.pcs-expand-btn {
  background: rgba(79, 195, 247, 0.15);
  border: 1px solid #d4a574;
  color: #e8e6f0;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.pcs-full-rules {
  margin-top: 8px;
  max-height: 140px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.5;
  color: #c9c5da;
  white-space: pre-wrap;
}
.pcs-timer-block {
  align-self: flex-end;
  width: 100%;
  max-width: 220px;
}
.pcs-timer-bar-outer {
  height: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(212, 165, 116, 0.35);
}
.pcs-timer-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #81d4fa);
  border-radius: 3px;
  transition: width 0.2s linear;
}
.pcs-timer-caption {
  font-size: 11px;
  color: #9e9bb8;
  text-align: right;
  margin-top: 3px;
}
.pcs-body :deep(.modal-box) {
  margin: 0 auto;
}
.pcs-bare .pcs-body-standalone :deep(.modal-box) {
  margin: inherit;
}
@media (max-width: 520px) {
  .pcs-header {
    grid-template-columns: 1fr;
  }
  .pcs-timer-block {
    max-width: none;
  }
}
</style>
