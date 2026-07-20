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
.vehicle-hero { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px; overflow: hidden; }
.vehicle-image { position: relative; z-index: 2; width: 230px; max-width: 70vw; height: 310px; transition: opacity .22s ease, transform .22s ease; }
.vehicle-hero.disconnected .vehicle-image { opacity: .42; }
.ready-glow { position: absolute; z-index: 1; width: 220px; height: 280px; border-radius: 50%; background: rgba(64,209,132,.12); filter: blur(28px); }
.trunk-glow { position: absolute; z-index: 1; bottom: 24px; width: 150px; height: 64px; border-radius: 50%; background: rgba(237,41,38,.5); filter: blur(18px); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
@media (max-height: 700px) {
  .vehicle-hero { min-height: 250px; }
  .vehicle-image { height: 260px; }
}
</style>
