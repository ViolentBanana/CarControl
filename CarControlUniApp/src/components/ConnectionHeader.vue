<script setup>
defineProps({
  status: { type: String, required: true },
  ready: { type: Boolean, default: false },
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
      <button class="utility-button" @click="$emit('openLogs')">日志</button>
    </view>

    <view class="status-row">
      <view class="status-copy">
        <view v-if="ready" class="ready-dot" />
        <text class="status">{{ status }}</text>
      </view>
      <button v-if="showRetry" class="utility-button" @click="$emit('retry')">重新扫描</button>
    </view>
  </view>
</template>

<style scoped>
.connection-header { display: flex; flex-direction: column; gap: 10px; }
.title-row, .status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.identity, .status-copy { display: flex; align-items: center; min-width: 0; }
.identity { gap: 10px; }
.status-copy { flex: 1; gap: 10px; }
.title { color: #fff; font-size: 22px; line-height: 1.25; font-weight: 760; letter-spacing: -0.4px; }
.badge { color: rgba(255,255,255,.72); background: #13161b; border: 1px solid rgba(255,255,255,.05); border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 650; }
.status { color: rgba(255,255,255,.72); font-size: 14px; line-height: 20px; }
.ready-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #40d184; box-shadow: 0 0 12px rgba(64,209,132,.62); }
.utility-button { display: flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 44px; min-height: 44px; margin: 0; padding: 0 14px; color: #fff; background: #13161b; border: 1px solid rgba(255,255,255,.055); border-radius: 999px; font-size: 14px; font-weight: 650; line-height: 1; }
.utility-button::after { border: none; }
.utility-button:active { opacity: .72; transform: scale(.97); }
@media (max-width: 340px) {
  .title-row, .status-row { align-items: flex-start; flex-wrap: wrap; }
  .status-copy { min-width: 190px; }
}
</style>
