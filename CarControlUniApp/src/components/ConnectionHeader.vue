<script setup>
defineProps({
  status: { type: String, required: true },
  ready: { type: Boolean, default: false },
  connected: { type: Boolean, default: false },
  pulse: { type: Boolean, default: false },
  showRetry: { type: Boolean, default: false },
})

defineEmits(['retry', 'openLogs'])
</script>

<template>
  <view class="connection-header">
    <view class="title-row">
      <view class="identity">
        <text class="title">Q60S 控制</text>
        <text class="badge">RM3</text>
      </view>
      <button class="log-button" aria-label="日志" @click="$emit('openLogs')">
        <text class="log-glyph">···</text>
        <text class="sr-only">日志</text>
      </button>
    </view>

    <view class="status-row">
      <view class="status-copy">
        <view
          class="status-dot"
          :class="{ 'status-dot--connected': ready || connected, 'status-dot--pulse': pulse }"
        />
        <text class="status">{{ status }}</text>
      </view>
      <button v-if="showRetry" class="retry-button" @click="$emit('retry')">重新扫描</button>
    </view>
  </view>
</template>

<style scoped>
.connection-header { display: flex; flex-direction: column; }
.title-row, .status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title-row { min-height: 48px; }
.status-row { min-height: 48px; }
.identity, .status-copy { display: flex; align-items: center; min-width: 0; }
.identity { gap: 10px; }
.status-copy { flex: 1; gap: 9px; overflow: hidden; }
.title { color: #fff; font-size: 20px; line-height: 24px; font-weight: 760; letter-spacing: -0.3px; }
.badge { color: rgba(255,255,255,.72); background: #13161b; border: 1px solid rgba(255,255,255,.05); border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 650; }
.status { overflow: hidden; color: rgba(255,255,255,.68); font-size: 13px; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.status-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: #ed2926; box-shadow: 0 0 10px rgba(237,41,38,.46); }
.status-dot--connected { background: #40d184; box-shadow: 0 0 12px rgba(64,209,132,.62); }
.status-dot--pulse { animation: status-pulse 1.8s ease-in-out infinite; }
.log-button, .retry-button { display: flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; color: #fff; background: #13161b; border: 1px solid rgba(255,255,255,.07); font-weight: 650; line-height: 1; transition: transform .16s ease, filter .16s ease; }
.log-button { width: 48px; height: 48px; min-width: 48px; min-height: 48px; padding: 0; border-radius: 50%; }
.log-glyph { margin-top: -5px; font-size: 24px; letter-spacing: 1px; line-height: 24px; }
.retry-button { min-width: 84px; min-height: 48px; padding: 0 12px; border-radius: 999px; font-size: 13px; }
.log-button::after, .retry-button::after { border: none; }
.log-button:active, .retry-button:active { filter: brightness(.82); transform: scale(.96); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
@keyframes status-pulse { 0%, 100% { opacity: .62; transform: scale(.86); } 50% { opacity: 1; transform: scale(1); } }
@media (max-width: 340px) {
  .title { font-size: 19px; }
  .identity { gap: 7px; }
  .retry-button { min-width: 76px; padding: 0 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .status-dot--pulse { animation: none; }
  .log-button, .retry-button { transition: none; }
}
</style>
