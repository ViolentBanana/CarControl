# BLE 日志一键复制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在连接日志面板中增加一键复制全部日志，并向用户反馈复制结果。

**Architecture:** 新建纯函数负责把日志数组格式化为稳定的多行文本；控制页负责调用 uni-app 剪贴板 API；日志面板只负责展示按钮并发出复制事件。这样格式化逻辑可单测，UI 组件不直接依赖平台 API。

**Tech Stack:** Vue 3、经典 uni-app、Vitest

## Global Constraints

- 每行复制格式固定为 `HH:mm:ss 消息`。
- 没有日志时复制按钮禁用。
- 复制不清空、不截断、不改写原日志。
- 不增加文件导出、分享面板或后台上传。

---

### Task 1: 日志格式化与复制交互

**Files:**
- Create: `CarControlUniApp/src/utils/log-export.js`
- Create: `CarControlUniApp/tests/log-export.test.js`
- Modify: `CarControlUniApp/src/components/DebugLogPanel.vue`
- Modify: `CarControlUniApp/src/pages/control/control.vue`
- Modify: `CarControlUniApp/tests/ui-contract.test.js`

**Interfaces:**
- Produces: `formatLogLines(lines: Array<{timestamp: number, message: string}>): string`
- Produces: `DebugLogPanel` 的 `copy` 事件
- Consumes: `uni.setClipboardData({ data, success, fail })` 与 `uni.showToast({ title, icon })`

- [ ] **Step 1: 写日志格式化失败测试**

```js
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
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd CarControlUniApp && npm test -- --run tests/log-export.test.js`

Expected: FAIL，因为 `src/utils/log-export.js` 尚不存在。

- [ ] **Step 3: 实现纯格式化函数**

```js
const pad = (value) => String(value).padStart(2, '0')

export function formatLogLines(lines = []) {
  return lines.map(({ timestamp, message }) => {
    const date = new Date(timestamp)
    const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':')
    return `${time} ${message}`
  }).join('\n')
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `cd CarControlUniApp && npm test -- --run tests/log-export.test.js`

Expected: 1 test passed。

- [ ] **Step 5: 增加复制按钮与事件**

在 `DebugLogPanel.vue`：

```vue
defineEmits(['close', 'copy'])

<view class="panel-actions">
  <button class="copy-button" :disabled="!lines.length" @click="$emit('copy')">复制全部</button>
  <button class="done-button" @click="$emit('close')">完成</button>
</view>
```

复制按钮沿用标题栏透明按钮样式；禁用态降低透明度。

- [ ] **Step 6: 接入 uni-app 剪贴板 API**

在 `control.vue` 导入 `formatLogLines`，增加：

```js
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
```

并绑定：

```vue
<DebugLogPanel
  :open="showLogs"
  :lines="logs"
  @copy="copyLogs"
  @close="showLogs = false"
/>
```

- [ ] **Step 7: 更新 UI 契约测试**

在 `ui-contract.test.js` 中检查日志面板包含 `复制全部`、`:disabled="!lines.length"` 和 `@click="$emit('copy')"`。

- [ ] **Step 8: 完整验证**

Run: `cd CarControlUniApp && npm test -- --run && npm run build:app && git diff --check`

Expected: 全部测试通过，App 资源构建成功，差异检查无输出。

- [ ] **Step 9: Android 真机验证**

使用 HBuilderX CLI 覆盖运行到 `3B165N0034G00000`，确认：

- 有日志时“复制全部”可点击。
- 剪贴板内容包含第一条到最后一条日志。
- 成功提示为“日志已复制”。
- 无日志时按钮禁用。

- [ ] **Step 10: 提交**

```bash
git add CarControlUniApp/src/utils/log-export.js \
  CarControlUniApp/tests/log-export.test.js \
  CarControlUniApp/src/components/DebugLogPanel.vue \
  CarControlUniApp/src/pages/control/control.vue \
  CarControlUniApp/tests/ui-contract.test.js \
  CarControlUniApp/src/utils/ble-data.js \
  CarControlUniApp/tests/vehicle-domain.test.js
git commit -m "fix: send BLE commands and copy debug logs"
```
