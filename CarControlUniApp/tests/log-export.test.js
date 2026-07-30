import { describe, expect, it } from 'vitest'
import { formatLogLines } from '../src/utils/log-export.js'

describe('log export', () => {
  it('formats all log lines in order for clipboard sharing', () => {
    const first = new Date(2026, 6, 30, 9, 28, 50).getTime()
    const second = new Date(2026, 6, 30, 9, 29, 2).getTime()

    expect(formatLogLines([
      { timestamp: first, message: '发送 MCF · 开锁' },
      { timestamp: second, message: 'MCF 发送成功' },
    ])).toBe('09:28:50 发送 MCF · 开锁\n09:29:02 MCF 发送成功')
  })
})
