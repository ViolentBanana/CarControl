export function createControlState(phase, details = {}) {
  return Object.freeze({ phase, ...details })
}

export function isReady(state) {
  return state.phase === 'ready'
}

export function canActivateControl({ enabled, busy }) {
  return enabled && !busy
}

export function connectionPresentation(phase) {
  return Object.freeze({
    connected: phase === 'ready' || phase === 'sending',
    pulse: phase === 'scanning' || phase === 'connecting',
  })
}

export function statusText(state) {
  const labels = {
    unavailable: '蓝牙未开启',
    disconnected: '未连接目标车辆',
    scanning: '正在搜索 RM3',
    connecting: '正在连接车辆',
    discovering: '正在初始化控制',
    ready: '车辆已连接',
    sending: '正在发送指令',
    failure: state.message ?? '连接失败',
  }

  return labels[state.phase] ?? '未知状态'
}
