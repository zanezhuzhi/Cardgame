<template>
  <button
    :class="buttonClasses"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  click: []
}>()

const buttonClasses = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  {
    'btn--disabled': props.disabled || props.loading,
    'btn--loading': props.loading
  }
])

const handleClick = (e: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click')
  }
}
</script>

<style scoped>
.btn {
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: bold;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.btn:disabled,
.btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* 尺寸变体 */
.btn--sm {
  padding: 8px 16px;
  font-size: var(--font-size-base);
  height: var(--btn-height-sm);
}

.btn--md {
  padding: 14px 36px;
  font-size: var(--font-size-md);
  height: var(--btn-height);
}

.btn--lg {
  padding: 16px 48px;
  font-size: var(--font-size-lg);
  height: var(--btn-height-lg);
}

/* 类型变体 */
.btn--primary {
  background: linear-gradient(135deg, var(--gold-border), var(--gold-dark));
  color: var(--bg-primary);
  border: 2px solid var(--gold-bright);
  box-shadow: var(--shadow-gold-md);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-gold-lg);
  background: linear-gradient(135deg, var(--gold-bright), var(--gold-border));
}

.btn--secondary {
  background: rgba(212, 165, 116, 0.2);
  color: var(--gold-border);
  border: 2px solid var(--gold-border);
}

.btn--secondary:hover:not(:disabled) {
  background: rgba(212, 165, 116, 0.4);
  border-color: var(--gold-bright);
  color: var(--gold-bright);
}

.btn--danger {
  background: linear-gradient(135deg, #c62828, #b71c1c);
  color: #fff;
  border: 2px solid var(--gold-border);
  box-shadow: var(--shadow-md);
}

.btn--danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  background: linear-gradient(135deg, #e53935, #d32f2f);
}

/* 加载状态 */
.btn--loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  right: calc(50% - 8px);
  top: calc(50% - 8px);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
