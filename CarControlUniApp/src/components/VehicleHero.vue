<script setup>
import { computed } from 'vue'

const props = defineProps({
  ready: { type: Boolean, default: false },
  disconnected: { type: Boolean, default: false },
  trunkOpen: { type: Boolean, default: false },
})

const artwork = computed(() => props.trunkOpen
  ? '/static/vehicle/vehicle-top-trunk-open.png'
  : '/static/vehicle/vehicle-top.png')
</script>

<template>
  <view class="vehicle-hero" :class="{ ready, disconnected }">
    <view v-if="ready" class="ready-glow" />
    <image
      class="vehicle-image"
      :src="artwork"
      mode="aspectFit"
      :aria-label="trunkOpen ? '车辆俯视图，尾箱指令已发送' : '车辆俯视图'"
    />
    <view v-if="trunkOpen" class="trunk-glow" />
    <text v-if="trunkOpen" class="sr-only">尾箱指令已发送</text>
  </view>
</template>

<style scoped>
.vehicle-hero { position: relative; display: flex; align-items: flex-end; justify-content: center; flex: 1 1 0; width: 100%; min-height: 0; overflow: hidden; }
.vehicle-image { position: relative; z-index: 2; width: min(72vw, 290px); height: 100%; max-height: 430px; transition: opacity .22s ease, transform .22s ease; }
.vehicle-hero.disconnected .vehicle-image { opacity: .72; }
.ready-glow { position: absolute; z-index: 1; width: min(58vw, 232px); height: 76%; border-radius: 50%; background: rgba(64,209,132,.13); filter: blur(30px); }
.trunk-glow { position: absolute; z-index: 1; bottom: 7%; width: 168px; height: 68px; border-radius: 50%; background: rgba(237,41,38,.52); filter: blur(18px); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
@media (max-height: 700px) {
  .vehicle-image { width: min(64vw, 240px); max-height: 270px; }
}
@media (prefers-reduced-motion: reduce) {
  .vehicle-image { transition: none; }
}
</style>
