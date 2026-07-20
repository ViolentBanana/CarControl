# CarControl 多端版

基于 Vue 3 与经典 uni-app 的 Q60S 车辆控制界面。App 通过系统 BLE API 连接名称包含 `RM3` 的设备，仅在发现 `FFF0` 服务下的可写特征后启用控制按钮。

## 已实现

- Android App、iOS App、微信小程序共用一套业务代码
- 深色 Q60S 俯视车辆界面与尾箱打开状态
- 锁车 `MSF`、开锁 `MCF`、尾箱 `MCK`
- RM3 设备过滤、FFF0 服务校验、连接状态、重新扫描和调试日志
- 重复指令拦截、连接代次保护、断连立即禁用和 3 秒写入超时
- App URL Scheme：`carcontrol://send?cmd=MSF`
- H5 仅供界面预览，并明确提示当前平台不支持蓝牙控制

## 本地验证

```bash
npm install
npm test -- --run
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

构建目录：

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`
- App 资源：`dist/build/app`

`npm run build:app` 只生成 App 资源，不会直接生成 APK 或 IPA。

## Android 真机运行

1. 用 HBuilderX 导入本目录 `CarControlUniApp`。
2. 手机开启开发者选项和 USB 调试，连接数据线并接受调试授权。
3. 在终端运行 `adb devices -l`，确认设备状态为 `device`。
4. HBuilderX 选择“运行 → 运行到手机或模拟器 → 运行到 Android App 基座”。
5. 首次进入时允许“附近设备/蓝牙”权限；Android 11 及以下机型如系统询问定位权限，也需要允许才能扫描 BLE。
6. 靠近车辆并确认 RM3 模块已通电；界面显示“车辆已连接”后控制按钮才可操作。

项目在 `manifest.json` 中启用了官方 `Bluetooth` 模块。HBuilderX 会依据 Android 版本注入 BLE 权限；项目额外声明 BLE 硬件要求，避免在不支持 BLE 的设备上误装。

## 生成并安装 APK

1. 在 HBuilderX 打开 `manifest.json`，按提示获取 DCloud AppID；仓库有意保留空 AppID。
2. 选择“发行 → 原生 App-云打包”。
3. Android 包名使用 `com.chen.carcontrol`，选择自己的签名证书或调试证书。
4. 不要把 keystore、证书密码或 DCloud 账号信息提交到仓库。
5. 下载实际 APK 后执行：

```bash
adb install -r /absolute/path/to/CarControl.apk
```

只有 APK 文件真实生成且上述安装命令成功后，才算完成 Android 安装交付。

## iOS 与微信小程序

- iOS App：HBuilderX 选择“发行 → 原生 App-云打包”，配置自己的 Bundle ID、证书和描述文件。最低系统版本为 iOS 12。
- 微信小程序：执行 `npm run build:mp-weixin`，再用微信开发者工具导入 `dist/build/mp-weixin`。发布前填写自己的微信小程序 AppID。
- 小程序蓝牙同样只匹配 RM3/FFF0；使用时必须由用户在小程序内发起连接。

## RM3 真机验收清单

当前仓库已通过自动测试与三端资源构建，以下项目必须在实际 Android 手机和车辆旁完成：

- [ ] 关闭手机蓝牙时，界面显示蓝牙不可用且按钮禁用
- [ ] 开启蓝牙后，只接受名称包含 RM3 的设备
- [ ] 未发现 FFF0 可写特征前，三个控制按钮保持禁用
- [ ] 锁车只写入一次 ASCII `MSF`
- [ ] 开锁只写入一次 ASCII `MCF`
- [ ] 尾箱只写入一次 ASCII `MCK`，成功后显示尾箱打开图
- [ ] 连续点击不会重复发送，发送期间按钮禁用
- [ ] 关闭 RM3 或离开范围后立即显示断开，重新扫描可以恢复连接
- [ ] 日志能看到扫描、连接、就绪、发送和断连事件

验收时记录手机型号、Android 版本、RM3 固件版本与失败日志，便于复现设备差异。

## 关键代码

- `src/composables/useVehicleController.js`：扫描、连接、指令和竞态状态机
- `src/services/bluetooth-service.js`：uni-app BLE API 适配层
- `src/pages/control/control.vue`：多端控制页与 App URL Scheme 处理
- `src/domain/vehicle-command.js`：不可变车辆指令定义
