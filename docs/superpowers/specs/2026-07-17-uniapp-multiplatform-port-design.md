# CarControl uni-app 多端迁移设计

## 背景

现有 SwiftUI iOS 版本已经完成深色车辆主控页、目标蓝牙连接状态机、三条车辆指令、调试日志、操作反馈和外部 URL 指令。本阶段不再扩展业务功能，而是将这些已经确定的功能与视觉迁移到一套可运行于 Android App、iOS App 和微信小程序的代码中。

Android App 是第一验收平台，因为当前具备 Android 真机。iOS App 和微信小程序使用同一业务层与页面结构，在 Android 真机验证通过后依次完成平台打包验证。

## 技术选择

使用经典 uni-app、Vue 3 和 Composition API。当前功能只依赖 uni-app 已提供的 BLE 扫描、连接、服务发现、特征发现和写入 API，不引入 uni-app x、Flutter、第三方 BLE 插件或后端服务。

多端工程放在现有仓库的 `CarControlUniApp/` 目录。原 SwiftUI 工程继续保留，作为视觉、协议与行为参考，不删除、不重写，也不再作为本阶段主要交付物。

## 功能范围

多端版本完整迁移以下现有能力：

- 固定深色车辆主控页面。
- 原创俯视双门轿跑闭合与尾箱开启素材。
- 锁车主按钮、开锁按钮和尾箱按钮。
- 目标设备名称包含 `RM3`。
- BLE 服务 UUID 为 `FFF0`。
- 锁车发送 `MSF`、开锁发送 `MCF`、尾箱发送 `MCK`。
- App 启动后初始化蓝牙、检查已连接设备并自动扫描目标设备。
- 连接、服务发现、可写特征发现、断开、失败和重试状态。
- 只有目标设备、目标服务和可写特征全部就绪后才能操作。
- 发送中禁止重复操作，并提供成功、失败和超时反馈。
- 可见调试日志面板。
- App 平台支持 `carcontrol://send?cmd=MSF` 形式的外部指令；小程序不实现 URL Scheme。

## 非目标

- 不增加账号、网络服务、车辆定位或远程互联网控制。
- 不增加桌面小组件。
- 不实现后台常驻扫描或锁屏自动控制。
- 不增加固件升级、分包协议、通知订阅或多车辆管理。
- 不修复或改造现有 SwiftUI 小组件。
- 不要求 Web/H5 端支持 BLE；H5 可展示界面，但控制能力标记为当前平台不可用。

## 工程结构

```text
CarControlUniApp/
├── App.vue
├── main.js
├── manifest.json
├── pages.json
├── pages/control/control.vue
├── components/
│   ├── VehicleHero.vue
│   ├── VehicleControlButton.vue
│   ├── ConnectionHeader.vue
│   └── DebugLogPanel.vue
├── composables/useVehicleController.js
├── services/bluetooth-service.js
├── domain/
│   ├── vehicle-command.js
│   └── vehicle-control-state.js
├── utils/ble-data.js
└── static/vehicle/
    ├── vehicle-top.png
    └── vehicle-top-trunk-open.png
```

### 领域层

`vehicle-command.js` 是三条命令的唯一事实源。`vehicle-control-state.js` 定义蓝牙不可用、未连接、扫描、连接、发现服务、就绪、发送和失败状态，并提供按钮是否可用、状态文案和设备名称等派生值。

领域层不调用 `uni.*`，可在普通 Node.js 测试中验证。

### 蓝牙服务层

`bluetooth-service.js` 是唯一直接调用 `uni.openBluetoothAdapter`、`uni.startBluetoothDevicesDiscovery`、`uni.createBLEConnection`、`uni.getBLEDeviceServices`、`uni.getBLEDeviceCharacteristics` 和 `uni.writeBLECharacteristicValue` 的模块。

它负责：

- 注册和注销蓝牙事件监听。
- 将字符串指令编码为 `ArrayBuffer`。
- 处理 Android、iOS 和微信小程序的 API 返回差异。
- 确保停止扫描、关闭旧连接和清理监听器。
- 将底层错误转换为稳定的业务错误类型。

### 车辆控制器

`useVehicleController.js` 负责目标设备筛选、连接状态机、扫描 generation、连接 generation、写入 token、防重复、超时和日志。页面只能调用控制器公开的 `connect()`、`retry()`、`sendCommand()` 和 `dispose()`。

仅当以下条件同时满足时进入 `ready`：

1. 外设名称包含 `RM3`。
2. 已建立当前 generation 的连接。
3. 服务列表包含标准化后的 `FFF0`。
4. 该服务下存在支持 write 或 writeWithoutResponse 的特征。

### 页面与组件

页面保持 iOS 版本的视觉层级：顶部连接状态、中央车辆主视觉、底部三键控制。常规手机宽度使用横向三键；窄屏或系统大字体改为可滚动的分层布局，不缩小文字。

按钮提供默认、按下、不可用、发送中和失败状态。车辆尾箱图片只表示“尾箱指令已发送”，不宣称车辆已经确认执行。

## 平台差异

### Android App

- 第一验收平台。
- Android 12 及以上申请蓝牙扫描与连接权限；较低版本按系统要求申请定位权限。
- 产出可安装 APK，并使用真实 RM3 设备验证。

### iOS App

- 在 `manifest.json` 配置蓝牙隐私说明。
- 使用与 Android 相同的 uni-app BLE API 和业务状态机。
- 等 iOS 开发环境和签名条件可用后构建验证。

### 微信小程序

- 使用相同的 uni-app BLE API 和页面。
- 在用户明确操作后初始化蓝牙并连接，遵守小程序前台生命周期。
- 不提供 App URL Scheme；页面隐藏对应入口。

## 错误处理

- 蓝牙关闭或权限拒绝：显示明确原因和可执行的重试提示。
- 未找到 RM3：扫描十秒后停止并显示“未找到目标车辆”。
- 非 RM3：记录简短日志，不进入连接流程。
- 缺少 FFF0 或可写特征：断开当前连接并显示“车辆控制模块未就绪”。
- 连接断开：立即退出 ready、禁用按钮并提供重连。
- 写入失败或超时：显示对应指令失败；withResponse 超时后使当前会话失效并要求重连，避免迟到回调污染后续写入。
- 页面卸载：停止扫描、清理所有事件监听和定时器，避免重复回调。

## 测试与验收

### 自动化测试

- 三条命令严格映射为 `MSF`、`MCF` 和 `MCK`。
- 非 RM3 设备不能进入连接状态。
- 缺少 FFF0 或可写特征不能进入 ready。
- 发送期间不能重复写入。
- 旧扫描、旧连接和旧写入回调不能覆盖当前状态。
- 字符串正确转换为 UTF-8 `ArrayBuffer`。
- 页面卸载后监听器和定时器全部清理。

### Android 真机验收

1. 安装 APK 并授权蓝牙权限。
2. 蓝牙关闭时三个按钮不可用。
3. 开启蓝牙后能够扫描并只连接 RM3。
4. 找到 FFF0 可写特征后按钮启用。
5. 锁车、开锁、尾箱分别发送 `MSF`、`MCF`、`MCK`。
6. 快速重复点击只产生一次写入。
7. RM3 断开后按钮立即禁用并能够重连。
8. 日志准确反映扫描、连接、服务发现和写入结果。

Android 真机完成上述八项即视为第一阶段交付。iOS 与微信小程序随后使用同一测试清单完成各自平台验证。
