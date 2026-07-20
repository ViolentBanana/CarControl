<script setup>
const props = defineProps({
  command: { type: Object, required: true },
  primary: { type: Boolean, default: false },
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
    :class="{ primary, enabled, busy }"
    :disabled="!enabled || busy"
    :aria-label="command.title"
    @click="activate"
  >
    <text class="control-icon">{{ busy ? '···' : command.icon }}</text>
    <text class="control-label">{{ command.title }}</text>
  </button>
</template>

<style scoped>
.control-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; box-sizing: border-box; width: 76px; height: 76px; min-width: 44px; min-height: 44px; margin: 0; padding: 0; color: rgba(255,255,255,.72); background: #1f2229; border: 1px solid rgba(255,255,255,.055); border-radius: 50%; line-height: 1; transition: transform .16s ease, filter .16s ease, opacity .16s ease, background .2s ease; }
.control-button::after { border: none; }
.control-button.primary { width: 112px; height: 112px; }
.control-button.primary.enabled { color: #fff; background: #ed2926; border-color: rgba(255,255,255,.14); box-shadow: 0 14px 34px rgba(237,41,38,.24), inset 0 1px 0 rgba(255,255,255,.14); }
.control-button.enabled:not(.primary) { color: #fff; }
.control-button:active { transform: scale(.96); filter: brightness(.9); }
.control-button[disabled] { opacity: .58; }
.control-icon { font-size: 20px; line-height: 24px; }
.primary .control-icon { font-size: 25px; line-height: 28px; }
.control-label { font-size: 14px; font-weight: 650; white-space: nowrap; }
.primary .control-label { font-size: 16px; font-weight: 720; }
</style>
