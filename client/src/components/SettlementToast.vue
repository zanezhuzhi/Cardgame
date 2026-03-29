<template>
  <Teleport to="body">
    <Transition name="settlement-toast-fade">
      <div v-if="visible" class="settlement-toast-overlay" aria-live="polite">
        <div class="settlement-toast-panel">{{ message }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  /** 递增即可重新播放（同 logSeq 去重在父级完成） */
  trigger: number
  text: string
}>()

const visible = ref(false)
const message = ref('')
let t: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.trigger,
  () => {
    if (!props.text) return
    if (t) clearTimeout(t)
    message.value = props.text
    visible.value = true
    t = setTimeout(() => {
      visible.value = false
    }, 2800)
  }
)

onUnmounted(() => {
  if (t) clearTimeout(t)
})
</script>

<style scoped>
.settlement-toast-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 12000;
}
.settlement-toast-panel {
  max-width: min(88vw, 480px);
  padding: 14px 22px;
  background: rgba(26, 26, 46, 0.92);
  border: 1px solid #d4a574;
  border-radius: 12px;
  color: #e8e6f0;
  font-size: 15px;
  line-height: 1.5;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
.settlement-toast-fade-enter-active,
.settlement-toast-fade-leave-active {
  transition: opacity 0.35s ease;
}
.settlement-toast-fade-enter-from,
.settlement-toast-fade-leave-to {
  opacity: 0;
}
</style>
