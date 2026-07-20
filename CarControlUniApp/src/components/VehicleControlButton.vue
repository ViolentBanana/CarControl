<script setup>
const props = defineProps({
  command: { type: Object, required: true },
  primary: { type: Boolean, default: false },
  secondary: { type: Boolean, default: false },
  enabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['command'])

function activate() {
  if (props.enabled && !props.busy) emit('command', props.command.key)
}
</script>

<template>
  <button
    class="control-button"
    :class="{ primary, secondary, enabled, busy, 'control-button--secondary': secondary }"
    :disabled="!enabled || busy"
    :aria-label="command.title"
    @click="activate"
  >
    <text class="control-icon">{{ busy ? '···' : command.icon }}</text>
    <text class="control-label">{{ command.title }}</text>
  </button>
</template>

<style scoped>
.control-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; width: 60px; height: 60px; min-width: 48px; min-height: 48px; margin: 0; padding: 0; color: rgba(255,255,255,.38); background: #20242a; border: 1px solid rgba(255,255,255,.07); border-radius: 50%; line-height: 1; box-shadow: 0 10px 24px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.06); transition: transform .16s ease, filter .16s ease, background .16s ease, color .16s ease; }
.control-button::after { border: none; }
.control-button.primary { width: 88px; height: 88px; color: rgba(255,255,255,.58); background: #d92725; border-color: rgba(255,255,255,.13); box-shadow: 0 14px 32px rgba(237,41,38,.2), inset 0 1px 0 rgba(255,255,255,.16), inset 0 -10px 18px rgba(83,0,0,.18); }
.control-button.primary.enabled { color: #fff; background: #ed2926; box-shadow: 0 16px 36px rgba(237,41,38,.34), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -10px 18px rgba(83,0,0,.14); }
.control-button--secondary { width: 60px; height: 60px; background: #20242a; }
.control-button.enabled { color: #fff; }
.control-button.busy { color: #fff; filter: brightness(.9); }
.control-button:active { transform: scale(.96); filter: brightness(.9); }
.control-button[disabled] { background-color: #20242a !important; }
.control-button.primary[disabled] { background-color: #d92725 !important; }
.control-button[disabled] .control-icon, .control-button[disabled] .control-label { opacity: .78; }
.control-icon { font-size: 18px; line-height: 20px; }
.primary .control-icon { font-size: 23px; line-height: 25px; }
.control-label { font-size: 12px; font-weight: 650; white-space: nowrap; }
.primary .control-label { font-size: 14px; font-weight: 720; }
@media (prefers-reduced-motion: reduce) {
  .control-button { transition: none; }
}
</style>
