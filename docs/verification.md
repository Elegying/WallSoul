# 首版真实验证记录

日期：2026-09-09。所有“通过”均限定下述本机和当前构建；Mock 测试不代表真实豆包自动化可用。

## 环境

| 项目 | 本次证据 |
| --- | --- |
| 机器 | MacBook Air MacBookAir10,1 / Apple M1 / 8 GB |
| 系统 | macOS 26.6.2（25G83）/ arm64 |
| 工具 | Rust/Cargo 1.98.0、Node 24.20.0、Xcode 已安装 |
| 显示 | 系统物理分辨率 2560×1600；NSScreen 逻辑 1440×900、scale=2 |
| 渲染 | 壁纸画布上限 1920×1200，本机值由诊断页核验 |
| 豆包 | 2.27.12，bundle ID com.bot.pc.doubao |
| 应用身份 | /Applications/Doubao.app；Apple 签名 Team ID 96L78H6LMH；运行时 SecStaticCode 验证通过 |
| 代码起点 | 空目录，不是 Git 仓库，无已有代码/改动 |

## 已执行的构建与逻辑检查

- `npm ci/install`：依赖已解析并生成 package-lock，安装审计当时 0 vulnerabilities。
- `npm test`：角色文件存在性、路径穿越/远程/脚本拒绝、不兼容版本/损坏分层、迟到/其他会话事件拒绝。
- `npm run build`：角色包构建校验、TypeScript、Vite 通过。
- `cargo test --locked`：8 个 Rust 策略测试通过，覆盖能力降级、未确认接通、重复操作、取消后迟到、外部通话归属、挂断未确认、退出迟到事件和配置校验。
- `cargo clippy --locked -- -D warnings`：通过。
- `.app` release 构建并真实启动；不是网页截图或普通置顶窗口替代品。
- 本地 ad-hoc 完整 bundle 签名，`codesign --verify --deep --strict` 通过。未 Developer ID 签名、未公证、未创建对外发布 DMG。

## macOS 原生与交互

原生最小测试实际创建并撤下自有窗口，断言：

- `desktopWindow=-2147483623`；自有窗口 level `-2147483622`；`desktopIconWindow=-2147483603`。
- 自有窗口处于背景之上、图标之下；鼠标穿透为 true；canBecomeKey=false。
- frame 与选定 NSScreen 一致；collectionBehavior=81（canJoinAllSpaces / stationary / ignoresCycle）。

真实 Tauri 窗口诊断也确认相同 level、mousePass=true、canBecomeKey=false、visible=true、1440×900，独立 wallpaper WebView 上报实际帧率。

交互记录：

- 设置壁纸后显示“桌面陪伴中”，普通设置窗口保持在上方。
- Finder 辅助功能仍能识别桌面图标；未修改用户桌面文件。
- 演示模式隐藏真实豆包打开入口，显示“无真实通话”；四种姿态仅为演示。
- 从小幕切换阿澄，人物名称/描述/素材变化，真实通话状态未被伪造。
- 其余持续运行期间交互及帧率记录见下方最终补充。

## 豆包联动证据与边界

本机已安装并运行官方豆包。Info.plist 确实注册 `doubao` Scheme，但没有证据证明其支持语音通话路由，代码不调用猜测的路由。未发现可用的 sdef AppleScript 字典。

官方客户端截图可见右上电话图标；当前 AX 树对应按钮没有可用于稳定定位的名称。尚未取得“已接通”信号及可靠结束路径，因而**没有自动点击电话图标、没有发起测试通话、没有挂断已有通话**。这是按安全启动条件降级，不是自动化测试通过。

幕灵原生探针 AXIsProcessTrusted=false。未代替用户授予辅助功能、麦克风、摄像头或录屏权限。基础打开功能不需要这些权限。权限缺失时真实界面显示未授权，自动能力全部 false。

未取得真实说话/字幕/指定进程音频，真实模式始终自然待机；不会循环演示状态冒充同步。未经验证不会隐藏豆包窗口。用户需要自行完成语音通话验收。

## 尚未运行 / 尚未验收

- 豆包真实语音通话、自动开始/结束、状态观察、隐藏/最小化后持续通话、字幕、嘴型同步。
- 真实通话期间断网/豆包退出/更新/权限撤回恢复；代码检测降级不等于这些场景已在通话中测试。
- Stage Manager、多个 Spaces 的实际跨屏显示、Mission Control、显示桌面、普通应用全屏组合。
- 真实锁屏/睡眠/唤醒、外接屏插拔及主屏变化。原生通知/迁移已实现但实际组合未验证；特别是锁屏通知与显示器休息的顺序需单独验收。
- 桌面图标双击、右键、框选、文件拖动的完整人工验收。层级/穿透参数通过不等于所有交互都已实测。
- macOS 14 或 Intel Mac 真机。
- Windows 编译、原生壁纸、安装和 UI Automation；仅提供明确 Unsupported 结构和 CI。
- 远程 CI、签名公证、正式分发安装包。

## 官方依据

2026-09-09 查阅：

- [Tauri 2 窗口定制](https://v2.tauri.app/learn/window-customization/)
- [Tauri capabilities 与自定义命令限制](https://v2.tauri.app/security/capabilities/)
- [Apple desktopWindow](https://developer.apple.com/documentation/coregraphics/cgwindowlevelkey/desktopwindow)
- [Apple NSWindow.CollectionBehavior](https://developer.apple.com/documentation/appkit/nswindow/collectionbehavior-swift.struct)
- [豆包官方下载页](https://www.doubao.com/download/desktop)

Tauri/Wry 已下载源码同时核验：background_throttling 映射到 macOS 14+ 的公开 WKPreferences.inactiveSchedulingPolicy。

## 生成角色更新与额外检查

用户追加参考视频并要求自行生成素材后，新增高质量半身人物包 `soul`。实际浏览器预览核验了深色背景、色键边缘、托腮及整理头发姿态；当前为 2.5D 合成，不是完整三维模型。前端/素材测试扩展到 6 项，Rust 8 项测试及 clippy 在集成后重新通过。

持续运行阶段发现关闭面板后普通 macOS reopen 事件未恢复面板；通过 `open -n` 实测单实例转发能够恢复，随后补齐 `RunEvent::Reopen`。最终独立副本关闭面板后使用普通 `open artifacts/WallSoul.app`，已实测恢复同一面板和桌面场景。

最终人物实机复核：修复分条缩放造成的可见横纹，使用整张画面轻微偏移。真实桌面窗口截图确认无横纹、绿幕已移除、人物大比例半身及深蓝洋红背景正常。托腮姿态在真实 Tauri 面板显示正常。

暂停实测：壁纸诊断由约 27.8 fps 降至 1 fps，通话仍显示未知，取消操作明确不代表挂断。桌面层级、穿透、非激活属性在最终副本再次核验。

低功耗实测：面板 15 fps、桌面约 14.7 fps；关闭低功耗后恢复正常目标。整理头发、眨眼及演示姿态在最终副本截图核验。持续运行中停止壁纸后显示窗口预览，切换阿澄再切回幕灵，重建桌面窗口成功，真实通话状态保持未知。

可运行交付副本为 `artifacts/WallSoul.app`，对应压缩包 `artifacts/WallSoul-macOS-arm64-0.1.0.zip`，校验值在 `artifacts/SHA256SUMS`。压缩包约 10 MB，完整应用约 19 MB。仍是本地 ad-hoc 签名，未公证。

## 最终连续运行 30 分钟

最终修复版独立副本的同一进程 PID 37015 自 2026-09-09T13:21:42.342447+00:00 至 2026-09-09T13:51:42.417984+00:00 连续存活 1800 秒，共 61 条采样，脚本正常退出并返回 PASS。对应二进制 SHA-256：`bd8b602f7d466087ddd2088615a00461334c8ec0f83bffe98c15e81699b3b88c`。

- 采样文件：`docs/soak-main-process.csv`；脚本：`scripts/soak.py`。
- 主进程 CPU：中位数 3.8%，样本峰值 14.1%。这是 ps 报告值，不是整机/所有 WebKit 进程总占用。
- 主进程 RSS：启动 124.4 MiB，样本峰值 124.4 MiB，结束 40.1 MiB；最后十分钟范围 29.9–49.6 MiB。此范围未见持续单调增长，不据此声称不存在任何内存泄漏。
- **不包含 WebKit XPC 进程**；线程数字段本机 ps 不支持，标记 unavailable。
- 持续运行期间检查了关闭/恢复面板、暂停/恢复、低功耗、演示与手动切换、生成姿态、角色切换、停止及重建桌面窗口、取消待处理操作。没有验证真实通话的开始/结束。
- 接近结束时再次通过真实界面确认同一会话、面板响应、桌面 27.8 fps / 1920×1200，面板 29.3 fps；桌面 visible=true、mousePass=true、canBecomeKey=false、level=-2147483622。
- 最终压缩包独立解压后通过 codesign 完整性检查，二进制哈希与验收副本一致。

此前 `soak-before-render-fix.csv`、`soak-interrupted-by-update.csv`、`soak-before-compositing-fix.csv` 都是提前中断记录，未算作本次通过；其中一次在更新运行中的应用包时中断，未取得足够证据判定确切退出原因。最终副本在整个 30 分钟内未被替换或重新签名。

## 0.2 原形象连续动作与通话只读检查（2026-09-09）

本节为后续版本，前面的 30 分钟记录只对应 0.1，不自动延用到 0.2。

用户否定通用动漫模型后，已将其从发布目录与角色清单撤回。默认重新保留原 `soul` 写实半身形象。制作 80 帧、10 fps、8 秒循环的连续头部动作，运行时相邻帧混合。两个 4096×2560 RGBA 图集共约 20 MiB；原图未覆盖。图集原始解码约 80 MiB/渲染实例，另有合成缓冲和其他图片；不把素材文件大小当作运行内存。

浏览器实测：原写实脸部、短发和黑毛衣保留；连续转头/轻微点头/眼部变化显示；安静待机与自然动作切换；托腮姿态及返回连续待机；菜单无被拒绝的动漫角色。发现图集采样与区域边界细线后，增加帧内采样和独立混合缓冲，肩部末端淡入原身体。刷新后的不同动作截图确认细线不再出现，浏览器没有捕获到错误日志。

本次工具确实读取到用户手动发起的豆包通话计时控件，但幕灵自己的辅助功能权限与原生识别尚需单独验收。新增适配器只观察官方签名客户端 2.27.12 的严格计时控件结构；丢失信号回到未知；外部通话不变成幕灵自有通话。自动启停、真实说话、字幕和嘴型同步仍不支持。本次没有拨打或挂断用户通话。

已完成前端素材/策略测试与 Rust 策略测试、clippy，以及发布配置构建；具体应用签名、运行和短时采样结果见后续补充。Blender、LivePortrait 及模型文件不进入 .app。

### 0.2 可运行副本

最终应用 `artifacts/WallSoul.app` 的 Info.plist 版本为 0.2.0，主二进制 SHA-256 为 `6636cfc9cf060150941828f6efaef4fdf0693eed74bd3f9a76280db50c125bf1`。本地 ad-hoc 签名通过 `codesign --verify --deep --strict`，未 Developer ID 签名或公证。0.1 应用保留为 `artifacts/WallSoul-0.1.0.app`，旧 ZIP 仍保留。

新版 ZIP 约 31 MiB，SHA-256 为 `21a1cc3799a2b793eaeaa5d306b2d7f7b0eabbc9835e4d49f192c806b600d263`。独立解压至 `/tmp/wallsoul-0.2-verify` 后，签名验证通过且二进制哈希一致。

9 项前端/素材测试、10 项 Rust 测试及 clippy 通过，最终发布构建完成。没有把中途中止的旧前端构建作为最终交付。

实际启动新版 PID 78105，界面显示 0.2、原形象连续动作、自然动作控制。原生桌面窗口创建成功：level=-2147483622、mousePass=true、canBecomeKey=false、1440×900。桌面画布 1920×1200，加载稳定后观察到约 27 fps。该数值是当时渲染诊断，非所有状态的性能保证。

用户可直接查看 `artifacts/WallSoul-original-motion.mp4`：512×768、30 fps、约 7.8 秒无声动作预览，来源是同一组本地连续帧。视频导出无通话、无声音输入。

暂停检查：真实面板和桌面诊断均降至 1 fps，恢复后回到“桌面陪伴中”。暂停操作没有更改豆包麦克风或通话归属。新版幕灵当前仍报告 AX 未授权，因此原生真实通话计时识别尚未验收；已向用户提供手动授权入口，不把开发工具此前的观察当作本应用已经识别成功。

### 0.2 独立短时运行采样

`docs/soak-0.2-main-process.csv` 共 11 条记录，同一 PID 78105 连续存活 300.9 秒，脚本正常返回 PASS。主进程 CPU 中位 2.4%、采样峰值 5.6%；RSS 采样峰值 33.1 MiB、结束 18.7 MiB。**不包含 WebKit XPC、GPU 与其他进程**，不能据此声称整个应用只占这些资源，且不构成新版 30 分钟长时验收。

低功耗模式实际切换成功，桌面诊断约 14.5 fps；同时面板最近诊断为 9.3 fps，没有把设置目标 15 fps 当作面板已稳定达到。完成后关闭低功耗并恢复原人物自然动作、桌面陪伴运行状态。当前通话归属始终为未接管外部通话。
