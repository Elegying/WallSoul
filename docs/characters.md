# 角色包与正式形象替换

当前默认 `幕灵` 是根据用户视频生成的高质量半身形象；`小幕`、`阿澄` 保留为轻量技术演示角色。均不宣称是官方发行的人物模型。`阿澄` 是用于验证数据驱动切换的暖色变体。动画没有冒充豆包状态。

## 增加兼容角色

1. 在 `resources/characters/<id>/` 中加入 `manifest.json`、背景、预览图和分层图片。
2. `id` 仅小写字母、数字、短横线，需与目录名一致。
3. 运行 `npm run characters` 生成 catalog，再运行 `npm test && npm run build`。
4. 重新构建 `.app`。界面人物列表和渲染器自动识别，无需改动核心。

## 清单字段

| 字段 | 说明 |
| --- | --- |
| schemaVersion | 当前为 1，其他版本拒绝 |
| assetVersion | 三段数字资源版本，例如 1.0.0 |
| id/name/description | 稳定标识、中文名称、场景说明 |
| demo | 是否演示形象；正式素材来源核实前保持 true |
| preview/background | 包内自包含图片文件名 |
| layout | 所有分层共用的画布 width/height，最大 2048 |
| animation | breath、blink 周期（秒，至少 1） |
| layers | 最多 16 层，id 唯一，按顺序绘制 |
| layers[].src | 待机分层图片 |
| layers[].blink | 可选闭眼替换图 |
| layers[].speaking | 可选张嘴替换图，只在有依据的姿态下使用 |

参考完整清单：`resources/characters/lumi/manifest.json`。眼睛和嘴替换图必须与主图共用画布原点；聆听/思考是轻微整体倾斜，待机有呼吸与眨眼。演示说话嘴型为循环开合；真实模式没有信号就始终待机，不显示字幕。

## 素材约束

允许 SVG、PNG、WebP、JPG 文件名；拒绝路径穿越、绝对路径、URL、查询参数和脚本后缀。SVG 不得含 script、foreignObject、事件属性、外部链接、实体或外部 CSS。素材以 Image 绘制，不作为 HTML 注入。首版构建校验读取资源；部署不自动下载或执行角色脚本。

正式豆包角色替换需要提供可使用的正面人物、背景、预览及眼睛/嘴分层素材，明确使用许可和希望保留的视觉特征。保留通用图片方案以兼容 WKWebView 与 WebView2。替换本地形象不会更改豆包软件中的声音、人设、账号或记忆。

## 半身人物扩展字段

可选 `portrait` 字段启用同一 Canvas 渲染器的 2.5D 合成路径：chromaKey 当前只能为 green；blink、speaking、thinking、listening 为包内图片；eyes/mouth 是 `[x,y,width,height]` 合成区域，必须完全位于画布内。参见 `soul/manifest.json`。素材在加载时一次性色键处理，帧内不重复处理像素。新增兼容角色仅增加清单和资源。生成来源和完整提示词见 generated-materials.md。

## 可选连续动作

`portrait.idle` 增加 `sheets`（PNG 图集）、`columns`、`rows`、`tileSize`、`frames`、`fps`、`region`。region 是原人物画布中的 `[x,y,width,height]`。图集按行存帧，逐张图集接续。当前限制总图集像素不超过 2400 万，单图最多 8×8 帧，5–30 fps；构建时还验证 PNG 实际尺寸。

连续帧加载时一次性色键处理，保留已有 alpha；运行时不执行像素级模型推理。未提供该字段的旧人物使用原渲染路径。动作选项通过 settings.motion 的 auto/still 控制，暂停仍由原壁纸状态管理。
