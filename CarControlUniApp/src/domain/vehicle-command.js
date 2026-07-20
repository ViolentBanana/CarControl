export const VehicleCommand = Object.freeze({
  lock: Object.freeze({ key: 'lock', value: 'MSF', title: '锁车', icon: '🔒' }),
  unlock: Object.freeze({ key: 'unlock', value: 'MCF', title: '开锁', icon: '🔓' }),
  trunk: Object.freeze({ key: 'trunk', value: 'MCK', title: '尾箱', icon: '🚘' }),
})

export function commandFromValue(value) {
  return Object.values(VehicleCommand).find((command) => command.value === value) ?? null
}
