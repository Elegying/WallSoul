# Windows 11 x64 后续适配

当前共享前端、角色包、配置和状态逻辑适用 Windows；原生桌面/豆包/权限适配明确 Unsupported。双端 CI 配置已提供，但本地无 Windows 环境，未运行 Windows 编译或安装验证。

后续必须单独完成：

- Win32 WallpaperHost；如使用 WorkerW，隔离非契约兼容行为，不把一次 SetParent 视为实现完成。
- Explorer 重建、WorkerW 丢失、窗口重挂载和安全撤回。
- 多显示器、DPI v2、负坐标、显示器插拔和主屏变化。
- UI Automation 精确目标识别，官方豆包身份/版本/多版本选择，权限和完整启停观察协议。
- Windows 会话锁定、休眠/唤醒、托盘、任务栏穿透和释放资源。
- WebView2 后台绘制、SVG/PNG 解码、DPR 与内存实测。
- x64 构建、签名、安装包、SmartScreen 与干净系统安装/卸载。
- 真实桌面图标双击/右键/框选/文件拖动、虚拟桌面、全屏、Explorer 重启验收。

本轮 CI 在 Windows 上执行共享测试、clippy 和 `tauri build --no-bundle`；它只验证编译，不表示 Windows 壁纸可用。
