<script setup>
defineProps({
  open: { type: Boolean, default: false },
  lines: { type: Array, default: () => [] },
})

defineEmits(['close', 'copy'])

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}
</script>

<template>
  <view v-if="open" class="overlay" @click="$emit('close')">
    <view class="panel" @click.stop>
      <view class="panel-header">
        <text class="panel-title">连接日志</text>
        <view class="panel-actions">
          <button class="copy-button" :disabled="!lines.length" @click="$emit('copy')">复制全部</button>
          <button class="done-button" @click="$emit('close')">完成</button>
        </view>
      </view>
      <scroll-view class="log-scroll" scroll-y>
        <view v-if="!lines.length" class="empty-state">
          <text class="empty-icon">⌁</text>
          <text>暂无连接日志</text>
        </view>
        <view v-else class="log-list">
          <view v-for="(line, index) in lines" :key="`${line.timestamp}-${index}`" class="log-line">
            <text class="log-time">{{ formatTime(line.timestamp) }}</text>
            <text class="log-message">{{ line.message }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.overlay { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; background: rgba(0,0,0,.58); }
.panel { width: 100%; max-height: 68vh; padding-bottom: env(safe-area-inset-bottom); background: #13161b; border-radius: 22px 22px 0 0; box-shadow: 0 -20px 60px rgba(0,0,0,.4); }
.panel-header { display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; min-height: 58px; padding: 8px 18px; border-bottom: 1px solid rgba(255,255,255,.07); }
.panel-title { color: #fff; font-size: 17px; font-weight: 720; }
.panel-actions { display: flex; align-items: center; gap: 4px; }
.copy-button, .done-button { min-width: 44px; min-height: 44px; margin: 0; padding: 0 8px; color: #40d184; background: transparent; font-size: 15px; font-weight: 650; }
.copy-button::after, .done-button::after { border: none; }
.copy-button[disabled] { opacity: .45; }
.log-scroll { height: 42vh; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 180px; color: rgba(255,255,255,.52); font-size: 15px; }
.empty-icon { font-size: 28px; }
.log-list { padding: 14px 18px 22px; }
.log-line { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.045); }
.log-time { flex: 0 0 auto; color: rgba(255,255,255,.36); font-family: monospace; font-size: 11px; }
.log-message { color: rgba(255,255,255,.7); font-family: monospace; font-size: 12px; line-height: 18px; }
</style>
