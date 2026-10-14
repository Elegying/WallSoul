# 保留原形象的连续动作

用户明确否定通用动漫模型替换。发布角色清单保留 `soul` 原生成形象，撤回的 VRM 试验只留在 `assets-source/3d/prototype-character/`，不进入应用角色列表。`WallSoul-animation.blend` 同样是试验工程，不代表已完成原人物建模。

## 制作范围

用本机 LivePortrait 主网络对原始 `neutral.png` 做小幅连续转头、点头、歪头，并由原 `blink.png` 提取局部闭眼变化。嘴部没有输入说话驱动。这是保留输入形象的离线神经动画，不是可从任意角度旋转的完整人体模型；头部推理仍可能有局部细节误差。

既有身体、服装和画面风格保留。头部与原肩颈平滑合成；连续帧以本地图集运行，Canvas 对相邻帧插值显示，切换安静待机/姿态时短暂过渡。原有托腮、整理头发仍是姿态变体，尚未变成连续抬手动作。完整身体转身、下蹲、步行与游戏级动作融合未完成。

播放不依赖网络、Python、Blender、摄像头或麦克风。当前本地推理使用 MPS，3D 网格采样回退 CPU，制作一帧需要数十秒；因此只离线制作，不能宣称应用实时运行该模型。

## 来源和可复现路径

- 原形象：项目内置 imagegen 生成，原提示词见 `generated-materials.md`。
- LivePortrait：https://github.com/KlingAIResearch/LivePortrait ，本次源码提交 `9b294b3d0536135442ea73cb01e6cb3ca7029dd3`。
- 官方权重：https://huggingface.co/KlingTeam/LivePortrait
- 版权声明：`third-party/LivePortrait-LICENSE.txt`。
- 四个主网络的官方 LFS SHA-256：`third-party/liveportrait-models.json`；下载逐文件核验。
- 不安装或加载 InsightFace 检测权重；对已知项目原图使用固定裁切。未用第三方人物视频驱动，未上传用户视频。

本机工具目录 `tools/LivePortrait` 和独立 `.venv` 不打包进应用。生成中间帧在 `assets-source/original-motion/`。

```sh
# 安装一次官方工具和独立 Python 3.10 环境后
python3 scripts/fetch-original-motion-models.py
PYTORCH_ENABLE_MPS_FALLBACK=1 tools/LivePortrait/.venv/bin/python scripts/animate-original.py 80
tools/LivePortrait/.venv/bin/python scripts/pack-original-motion.py
npm run build
```

制作环境主要版本：Python 3.10.21、torch 2.3.0、torchvision 0.18.0、numpy 1.26.4、opencv-python 4.10.0.84、scipy 1.13.1。图集配置由可选 `portrait.idle` 字段扩展，老角色包不需要更改。

## 豆包边界

用户手动开启通话后，开发工具观察到豆包 2.27.12 的“通话中 分:秒”控件，旁边有两个图像节点。原生适配器新增严格版本、官方签名、控件角色及父节点结构匹配；只保存布尔状态，不保存聊天或计时文本。

这只支持在幕灵自身获得辅助功能权限后检查外部通话；外部通话不会被幕灵标记为自有会话。没有自动拨打、自动挂断或实际说话信号，人物自然动作不表示豆包正在聆听或说话。开发工具观察成功与幕灵自身识别成功是两项不同证据，原生实测结果另见 `verification.md`。

输入原图 SHA-256：`neutral.png` 为 `a7f0808575acdf0285fd39a7cf37ebc6b88c9670a7c403f8fdcf31c4f87e582d`；`blink.png` 为 `63b0e97759662396b2007b555f8bedb26efe40dcf24f3d34b22a0f248dbb734c`。制作没有覆盖这两张原图。
