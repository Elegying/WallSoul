# 幕灵 0.4 架构

## 边界

- `src/ui`：中文设置面板，消费 Rust 快照与事件。没有独立的真实通话状态机。
- `src/renderer`：跨平台 Canvas 2D。默认使用原角色的透明逐帧动画，另兼容自包含 SVG 和技术演示 VRM。角色加载失败停留于安全背景并显示错误。
- `src/contracts`：快照、音频、配置、角色包契约。事件含运行会话 UUID 和单调递增序号，旧序号及其他会话事件被丢弃。
- `src-tauri/src/core`：唯一状态所有者。壁纸与音频采集状态独立；不会从磁盘恢复正在采集状态。
- `src-tauri/src/platform`：WallpaperHost、SystemEvents 与独立的 audio 命令接口。
- `platform/macos`：Swift 静态库封装公开 AppKit、Core Graphics、AVFoundation 和 Core Audio API，Rust 通过 C ABI 调用。共享业务不依赖 AppKit。
- `platform/windows`：可编译的隔离适配器；需要原生能力的操作明确返回 Unsupported。

Swift 仅用于系统适配，人物动画、设置、资源和业务均共享。该方案没有恢复到 SwiftUI/SpriteKit 路线。

## 桌面宿主

Tauri 创建无边框、不聚焦、不进入任务切换器的独立 WebView 窗口；所有 AppKit 操作切回主线程。窗口使用 `CGWindowLevelForKey(.desktopWindow) + 1`，运行时检查其低于 `.desktopIconWindow`，设 `ignoresMouseEvents`，按 NSScreen 的逻辑 frame 定位，避免混用 Core Graphics 像素坐标。使用 canJoinAllSpaces、stationary、ignoresCycle；不会切换为独立全屏 Space。

不改系统壁纸、不操作 Finder/Dock。停止销毁自有窗口，并清理 Swift 对窗口的引用。再次设为壁纸只复用或创建一个 `wallpaper` 窗口。

屏幕/睡眠状态由原生查询及 NSWorkspace 通知提供，Rust 每秒检查。选定屏幕消失迁到首个可用屏幕；没有屏幕则报告失败。用户切换目标屏幕后点击“重新应用壁纸”生效。睡眠和显示器休息先隐藏桌面窗口，恢复重新挂载。普通应用全屏、Stage Manager、锁屏和热插拔的实际组合仍需按验收表逐项检查。

## 绘制与资源

目标 30 fps，低功耗 15 fps，暂停/休息/原生窗口被完全遮挡时降至 1 fps 静态刷新。画布最长边上限 1920、DPR 上限 1.5。普通面板使用 requestAnimationFrame 与 document.visibilityState；独立桌面使用有上限的 timeout 调度，避免 WKWebView 非活动窗口 rAF 冻结；只有壁纸窗口关闭 WebKit inactive scheduling 限制。native occlusionState 用于完全遮挡时降耗。定时器只驱动视觉，不能驱动真实通话状态。

每个角色只缓存当前分层图片，切换时取消旧循环、断开 ResizeObserver、移除监听并释放图片引用。每 5 秒上报实际绘制 fps 与画布尺寸，不能当成整机性能。窗口隐藏后的旧采样可能保留在诊断页，需结合窗口状态解释。

## 被动音频与权限

不控制豆包，不读聊天，不进行 AI 推理。`AudioReactive.swift` 在系统权限允许后启动 AVAudioEngine 麦克风与所选应用的私有 Core Audio Process Tap。只匹配所选 bundle ID 及其子进程标识；macOS 26 使用 bundle 恢复能力。采集不静音用户应用，不创建音频文件，只将标量强度与变化传回 Rust。macOS 14.2 以下明确不支持。

麦克风超过阈值时保持约 0.8 秒正面注视；所选输出超过阈值时优先同步口型并清理旧输入保持时间。嘴部做短时平滑，表情为平静/活跃语气映射，不宣称逐音素或语义识别。源应用退出时释放采集并报告错误。

## 状态与退出

一个 Rust Mutex 管理快照，原生操作派发主线程；音频开启期间约 20 Hz 更新标量，系统状态每秒检查。Swift 授权回调由递增代数防止停止后的迟到授权重新采集。停止、锁屏、睡眠、退出释放麦克风 tap、设备回调、聚合设备与 process tap，恢复后需用户手动启动。

暂停画面不等于停止采集；退出幕灵不挂断用户在豆包中的通话。单实例插件防止重复宿主。正常退出清理窗口、观察者与运行标志，异常退出后的提示不再恢复旧语音状态。

## 存储与安全

配置仅存在系统应用配置目录 `app.wallsoul.desktop/settings.json`，临时文件再 rename。状态日志只保留内存中最近 60 条，不包含账号、音频或聊天正文。主面板具有有限业务命令；壁纸只可读快照/角色、监听事件和上报有限指标。无 shell、任意文件系统、远程资源或通用进程执行能力。

角色目录通过构建校验生成 catalog，Rust 内嵌 catalog；前端再次校验。首版不支持用户运行中从任意路径导入资源，新增角色随版本发布。

## 用户视频后的表现层扩展

保留 Canvas 2D 与同一角色包契约，可选 portrait 配置加载生成的半身人物。资源加载时一次性色键合成；局部眼睛/嘴巴使用有限区域；身体动作和十组表情使用原尺寸透明帧，最多 8 帧缓存和 4 个在途加载；原图与候选哈希由离线打包校验。进出动作平滑过渡。该方案为 2.5D，不称完整三维骨骼。macOS 用公开 NSEvent.mouseLocation 读取当前指针位置，归一化到所在屏幕，低频传给渲染器平滑头部方向；指针读取不记录轨迹，麦克风与音频权限仅用于用户主动开启的声音跟随。

浏览器视觉预览单独放在 BrowserPreview.tsx，不接入真实会话，也不模拟豆包成功；桌面应用仍只以 Rust 为状态来源。
