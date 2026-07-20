<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import ConnectionHeader from '../../components/ConnectionHeader.vue'
import DebugLogPanel from '../../components/DebugLogPanel.vue'
import VehicleControlButton from '../../components/VehicleControlButton.vue'
import VehicleHero from '../../components/VehicleHero.vue'
import { createVehicleController } from '../../composables/useVehicleController.js'
import { VehicleCommand, commandFromValue } from '../../domain/vehicle-command.js'
import { createControlState, statusText } from '../../domain/vehicle-control-state.js'
import { createBluetoothService } from '../../services/bluetooth-service.js'

const unsupportedState = ref(createControlState('unavailable', {
  message: '当前平台不支持蓝牙控制',
}))
const showLogs = ref(false)
const pendingDeepLinkCommand = ref(null)
let controller = null

// #ifndef H5
controller = createVehicleController(createBluetoothService(uni))
// #endif

const controlState = computed(() => controller?.state.value ?? unsupportedState.value)
const logs = computed(() => controller?.logs.value ?? [])
const lastResult = computed(() => controller?.lastResult.value ?? null)
const ready = computed(() => controlState.value.phase === 'ready')
const disconnected = computed(() => ['disconnected', 'unavailable'].includes(controlState.value.phase))
const status = computed(() => controlState.value.message ?? statusText(controlState.value))
const showRetry = computed(() => ['disconnected', 'failure'].includes(controlState.value.phase))
const trunkOpen = computed(() => lastResult.value?.command === 'trunk' && lastResult.value?.ok)

function sendCommand(key) {
  const command = VehicleCommand[key]
  if (command && controller) void controller.sendCommand(command)
}

function isBusy(key) {
  return controlState.value.phase === 'sending'
    && controlState.value.command === VehicleCommand[key].value
}

function retry() {
  if (controller) void controller.retry()
}

function queueDeepLink(rawUrl = '') {
  const match = String(rawUrl).match(/[?&]cmd=([^&]+)/i)
  if (!match) return
  pendingDeepLinkCommand.value = commandFromValue(decodeURIComponent(match[1]))
}

function readAppDeepLink() {
  // #ifdef APP-PLUS
  queueDeepLink(plus.runtime.arguments)
  // #endif
}

async function sendPendingDeepLink() {
  if (!ready.value || !pendingDeepLinkCommand.value || !controller) return
  const command = pendingDeepLinkCommand.value
  pendingDeepLinkCommand.value = null
  await controller.sendCommand(command)
}

watch(ready, () => { void sendPendingDeepLink() })

onLoad(() => {
  readAppDeepLink()
  if (controller) void controller.connect()
})

onShow(() => {
  readAppDeepLink()
  void sendPendingDeepLink()
})

onUnload(() => controller?.dispose())
</script>

<template>
  <view class="control-page">
    <view class="content">
      <ConnectionHeader
        :status="status"
        :ready="ready"
        :show-retry="showRetry"
        @retry="retry"
        @open-logs="showLogs = true"
      />

      <view v-if="lastResult" class="result-banner" :class="{ failure: !lastResult.ok }">
        <text class="result-icon">{{ lastResult.ok ? '✓' : '!' }}</text>
        <text>{{ lastResult.message }}</text>
      </view>

      <VehicleHero :ready="ready" :disconnected="disconnected" :trunk-open="trunkOpen" />

      <view class="control-dock">
        <VehicleControlButton
          :command="VehicleCommand.unlock"
          :enabled="ready"
          :busy="isBusy('unlock')"
          @command="sendCommand"
        />
        <VehicleControlButton
          primary
          :command="VehicleCommand.lock"
          :enabled="ready"
          :busy="isBusy('lock')"
          @command="sendCommand"
        />
        <VehicleControlButton
          :command="VehicleCommand.trunk"
          :enabled="ready"
          :busy="isBusy('trunk')"
          @command="sendCommand"
        />
      </view>

    </view>

    <DebugLogPanel :open="showLogs" :lines="logs" @close="showLogs = false" />
  </view>
</template>

<style scoped>
.control-page {
  --bg: #090b0e;
  --surface: #13161b;
  --control: #1f2229;
  --ink: #ffffff;
  --muted: rgba(255,255,255,.72);
  --accent: #ed2926;
  --ready: #40d184;
  box-sizing: border-box;
  min-height: 100vh;
  color: var(--ink);
  background: var(--bg);
}
.content { display: flex; flex-direction: column; box-sizing: border-box; min-height: 100vh; padding: calc(12px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); }
.result-banner { display: flex; align-items: center; gap: 8px; box-sizing: border-box; min-height: 44px; margin-top: 12px; padding: 10px 14px; color: var(--ready); background: var(--surface); border: 1px solid rgba(255,255,255,.05); border-radius: 12px; font-size: 14px; font-weight: 650; }
.result-banner.failure { color: var(--accent); }
.result-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font-size: 12px; }
.control-dock { display: flex; align-items: center; justify-content: center; gap: 24px; width: 100%; margin-top: auto; padding: 18px 0; }
@media (max-width: 340px) {
  .content { padding-left: 16px; padding-right: 16px; }
  .control-dock { flex-direction: column; gap: 18px; }
  .control-dock :nth-child(1) { order: 2; }
  .control-dock :nth-child(2) { order: 1; }
  .control-dock :nth-child(3) { order: 3; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
</style>
