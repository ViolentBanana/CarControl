export function createControlState(phase, details = {}) {
  return Object.freeze({ phase, ...details })
}

export function isReady(state) {
  return state.phase === 'ready'
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
