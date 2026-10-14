# 幕灵 · WallSoul

当前本机安装版为 0.6.0，采用系统透明视频播放，保留完整人物与逐帧兼容回退。暂停诊断反馈循环已修复并替换安装版，音频、暂停/恢复、菜单退出/重启和 30 分钟混合运行验收已完成。完整进度与验收记录见 [0.6.0 安装验收](docs/acceptance-0.6.0.md)。技术与素材证据见 [透明视频记录](docs/native-video-experiment.md)。

本机桌面陪伴应用：保留原生成角色，以连续动画表现活动，跟随麦克风和所选应用的声音。Tauri 2、React、Rust 与 macOS 原生 Core Audio。

本版已移除内置 AI 对话、Ollama 启动、本地转写播音，以及豆包桌面控制与辅助功能探测。豆包中的登录、通话和挂断由用户自行操作。幕灵运行时不调用模型、不上传音频；Hugging Face 仅用于开发阶段离线制作人物素材。

## 运行与使用

```sh
open /Applications/幕灵.app
```

安装版使用固定专用本地证书签名；不要交替运行历史候选包。当前为本机 Apple Silicon 开发包，没有 Developer ID 公证，不代表公开分发安装包。系统要求 macOS 14.0；音频跟随要求 14.2 及以上。本机验收环境为 macOS 26.6.2、M1 MacBook Air。

1. 打开面板，选择屏幕、位置、大小，点击“设为桌面壁纸”。壁纸鼠标穿透，不更改系统壁纸。
2. 在豆包中自行开始语音。在幕灵中选择声音所在的应用，网页版选择浏览器，再点击“开始跟随”。第一次需要系统麦克风与音频录制权限。
3. 麦克风超过阈值时，人物进入闭嘴聆听片段并注视前方。所选应用输出声音时，轮换五段完整人物说话视频；强弱与节奏用于平静/活跃语气提示。片段会沿原方向完成收势后切换。
4. “停止音频跟随”释放双路采集；锁屏、睡眠和退出也会停止，恢复后不会自动重新开始。暂停画面不等于停止采集，也不等于豆包挂断。
5. 可手动选择十组表情、整理头发与挥手。“自然随机”以静息为主，在明显动作之间留出 12–20 秒；安静时不播放无声说话。折叠区的“全部状态演示”允许轮换包括说话、聆听在内的所有片段，真实声音活动优先。

注意：输入检测基于音量门限，不是语音识别；噪声或其他扬声器声音也可能触发倾听。来源发声期间抑制麦克风回声触发，戴耳机效果更稳定。同一应用其他标签页或音效属于同一声音来源。当前不理解十种语义情绪、不做逐音素口型；嘴唇、牙齿与下颌运动都来自原生视频，不叠加人工嘴部。十组表情是可选择的动画素材。

0.5.0 修复原生帧的过渡失锐、闭嘴聆听、手动排队、采集来源失效及连续设置保存，并缩减安装资源。详见 [本轮验证与边界](docs/acceptance-0.5.0.md)。

## 人物与一致性

原图 `resources/characters/soul/neutral.png` 是唯一外观基准。当前动作原生尺寸为 560×832，不重画或替换原人物。播放使用源视频完整帧；说话与身体片段保留原生入口，收尾作有限位置校正。聆听、静息以及“喜”“怒”仅使用审查过的安全区间再返回原帧，这是短期质量折衷。统一尺寸与首尾姿态不能证明全部细节或衔接自然。

素材由人工抽帧审核，哈希固定原图和已审视频，打包前检查来源未变；生成工具不会直接替换正式素材。此校验防止文件误替换，不能自动证明每一帧身份完全相同。表情差异及手指细节仍有改进空间，见 [0.4 验收记录](docs/acceptance-0.4.md)。当前为生成素材驱动的 2.5D，不是任意视角 3D 模型。

macOS 完整人物使用 32 fps 透明视频，低功耗使用同尺寸、同速度的 16 fps 视频，最多保留两个播放槽。浏览器或视频播放失败时按需解码 PNG，兼容缓存最多 8 帧、4 个在途加载，不一次性预加载整库。可见画面仍消耗图形资源，不能承诺零发热。

## 开发与验证

需要 Node.js 24、npm、Rust 1.88 及以上。macOS 构建需要 Xcode 26 或更新版本及 macOS 26 SDK；应用最低运行系统仍为 macOS 14.0，较新的音频接口通过运行时版本检查启用。

依赖安全补丁的来源与独立回归测试见 [依赖安全修复与验证](docs/dependency-security.md)。

```sh
npm ci
npm test
npm run build:desktop
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings
xcrun swiftc -parse-as-library -module-cache-path /tmp/wallsoul-swift-test-cache src-tauri/src/platform/macos/AudioReactive.swift scripts/audio-reactive-test.swift -framework AppKit -framework AVFoundation -framework CoreAudio -o /tmp/wallsoul-audio-test
/tmp/wallsoul-audio-test
npm run tauri build -- --bundles app
```

正常退出固定开发包后，用 `python3 scripts/package-local.py` 更新它，签名说明见 [本机签名](docs/local-signing.md)。不要用临时 ad-hoc 签名替换固定入口。

原生测试前使用 `build:desktop`，生成轻量前端和仅含清单引用素材的 `artifacts/bundle-characters`。`tauri build`（含 `--no-bundle`）会自动执行这一步；普通 `npm run build` 用于完整浏览器预览。

日常浏览器预览使用 `npm run preview`；只修改代码时使用 `npm run dev`。浏览器仅视觉预览，真实采集请用桌面应用。不要启用轮询文件监听；Vite 已排除模型、素材和编译产物目录，避免后台高 CPU。

素材制作脚本位于 `scripts/generate-expression-set.py` 与 `scripts/pack-reviewed-expressions.py`。本机凭据放在受限的 `.local-hf/`，不进入代码、前端或安装包；生成消耗用户自己的 Hugging Face PRO 额度。Windows 原生音频/壁纸适配尚未实现。

浏览器连续验收页为 `speech-lab.html`，可执行固定动作序列、查看解码等待统计并录制 30 秒画面。它不采集音频，也不替代安装版验收。

早期文档和候选包仅为历史记录；旧版内置 AI、人工嘴部和豆包界面控制步骤均不适用于当前人物。
