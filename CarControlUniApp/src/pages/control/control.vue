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
import { requestAndroidBluetoothPermissions } from '../../services/android-bluetooth-permissions.js'
import { createBluetoothService } from '../../services/bluetooth-service.js'
import { formatLogLines } from '../../utils/log-export.js'

const unsupportedState = ref(createControlState('unavailable', {
  message: '当前平台不支持蓝牙控制',
}))
const showLogs = ref(false)
const pendingDeepLinkCommand = ref(null)
const permissionMessage = ref('')
let controller = null

// #ifndef H5
controller = createVehicleController(createBluetoothService(uni))
// #endif

const controlState = computed(() => (
  permissionMessage.value
    ? createControlState('failure', { message: permissionMessage.value })
    : controller?.state.value ?? unsupportedState.value
))
const logs = computed(() => controller?.logs.value ?? [])
const lastResult = computed(() => controller?.lastResult.value ?? null)
const ready = computed(() => controlState.value.phase === 'ready')
const connected = computed(() => ['ready', 'sending'].includes(controlState.value.phase))
const pulse = computed(() => ['scanning', 'connecting'].includes(controlState.value.phase))
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

async function ensureBluetoothPermissions() {
  // #ifdef APP-ANDROID
  try {
    const { osAndroidAPILevel } = uni.getSystemInfoSync()
    const result = await requestAndroidBluetoothPermissions(plus, osAndroidAPILevel)
    if (result.granted) {
      permissionMessage.value = ''
      return true
    }

    permissionMessage.value = '请授予附近设备权限后重试'
    if (result.deniedAlways) {
      uni.showModal({
        title: '需要蓝牙权限',
        content: '请在系统设置中允许附近设备权限，才能连接车辆。',
        confirmText: '打开设置',
        success: ({ confirm }) => {
          if (confirm) uni.openAppAuthorizeSetting()
        },
      })
    }
    return false
  } catch (error) {
    permissionMessage.value = error?.message ?? error?.errMsg ?? '蓝牙权限申请失败'
    return false
  }
  // #endif

  return true
}

async function connectVehicle() {
  if (!controller || !(await ensureBluetoothPermissions())) return false
  return controller.connect()
}

function retry() {
  void connectVehicle()
}

function copyLogs() {
  const data = formatLogLines(logs.value)
  if (!data) return
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: '日志已复制', icon: 'success' }),
    fail: (error) => uni.showToast({
      title: error?.errMsg ?? '复制失败',
      icon: 'none',
    }),
  })
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
  void connectVehicle()
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
        :connected="connected"
        :pulse="pulse"
        :show-retry="showRetry"
        @retry="retry"
        @open-logs="showLogs = true"
      />

      <view v-if="lastResult" class="result-banner" :class="{ failure: !lastResult.ok }">
        <text class="result-icon">{{ lastResult.ok ? '✓' : '!' }}</text>
        <text>{{ lastResult.message }}</text>
      </view>

      <VehicleHero
        :ready="connected"
        :disconnected="disconnected"
        :trunk-open="trunkOpen"
      />

      <view class="remote-zone">
        <text
          class="connection-hint"
          :class="{ 'is-hidden': connected }"
          :aria-hidden="connected"
        >建立车辆连接后可操作</text>
        <view class="remote-console" :class="{ 'is-disabled': !connected }">
          <VehicleControlButton
            class="side-control side-control--left"
            secondary
            :command="VehicleCommand.unlock"
            :connected="connected"
            :enabled="ready"
            :busy="isBusy('unlock')"
            @command="sendCommand"
          />
          <view class="primary-lock">
            <VehicleControlButton
              primary
              :command="VehicleCommand.lock"
              :connected="connected"
              :enabled="ready"
              :busy="isBusy('lock')"
              @command="sendCommand"
            />
          </view>
          <VehicleControlButton
            class="side-control side-control--right"
            secondary
            :command="VehicleCommand.trunk"
            :connected="connected"
            :enabled="ready"
            :busy="isBusy('trunk')"
            @command="sendCommand"
          />
        </view>
      </view>

    </view>

    <DebugLogPanel :open="showLogs" :lines="logs" @copy="copyLogs" @close="showLogs = false" />
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
.content { display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: 480px; min-height: 100vh; margin: 0 auto; padding: calc(10px + var(--status-bar-height)) 20px calc(18px + env(safe-area-inset-bottom)); }
.result-banner { display: flex; align-items: center; flex: 0 0 auto; gap: 8px; box-sizing: border-box; min-height: 44px; margin-top: 12px; padding: 10px 14px; color: var(--ready); background: var(--surface); border: 1px solid rgba(255,255,255,.05); border-radius: 12px; font-size: 14px; font-weight: 650; }
.result-banner.failure { color: var(--accent); }
.result-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font-size: 12px; }
.remote-zone { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; margin-top: clamp(4px, 1.4vh, 12px); }
.connection-hint { min-height: 20px; color: rgba(255,255,255,.54); font-size: 13px; line-height: 20px; }
.connection-hint.is-hidden { visibility: hidden; }
.remote-console { display: grid; grid-template-columns: 97px 106px 97px; align-items: center; justify-items: center; width: 300px; height: 154px; }
.primary-lock { position: relative; display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 106px; height: 154px; overflow: hidden; background: #191c22; border: 1px solid rgba(255,255,255,.075); border-radius: 53px; box-shadow: 0 20px 44px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.06), inset 0 -16px 28px rgba(0,0,0,.24); }
.primary-lock::before { content: ''; position: absolute; inset: 5px 5px auto; height: 70px; border-radius: 48px 48px 20px 20px; background: #252930; box-shadow: inset 0 1px 0 rgba(255,255,255,.07); }
.primary-lock :deep(.control-button) { position: relative; z-index: 1; }
.side-control--left { transform: translateX(7px); }
.side-control--right { transform: translateX(-7px); }
.side-control--left:active { transform: translateX(7px) scale(.96); }
.side-control--right:active { transform: translateX(-7px) scale(.96); }
@media (max-width: 340px) {
  .content { padding-left: 16px; padding-right: 16px; }
  .remote-console { transform: scale(.94); }
}
@media (max-height: 700px) {
  .content { padding-top: calc(6px + var(--status-bar-height)); padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
  .result-banner { min-height: 40px; margin-top: 6px; padding-top: 8px; padding-bottom: 8px; }
  .remote-zone { margin-top: 4px; }
  .remote-console { height: 150px; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
</style>
