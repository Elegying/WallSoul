# 用户参考驱动的人物素材

用户明确要求：没有素材，由开发方生成。本轮使用内置 imagegen 工具，未使用 CLI/API Key 或付费模型 API 接入应用。

## 已落盘并接入应用

目录：`resources/characters/soul/`

- `neutral.png`：高质量三维风格半身人物，基础姿态。
- `blink.png`：保持位置的闭眼变体，渲染器只合成眼部区域。
- `speaking.png`：保持位置的开口变体，只在明确演示中合成嘴部区域。
- `thinking.png`：托腮变体。
- `listening.png`：整理头发的变体。
- `background.svg`：本地代码绘制的深蓝/洋红背景，无系统图标/任务栏或播放器。
- `manifest.json`：数据驱动的资源、区域和版本清单。

首张工具输出含模拟棋盘格且没有 alpha 通道，已判定不合格，保留在 docs/generated-sources 作为来源记录，未被人物渲染引用。后续要求生成纯色素材背景，由通用 Canvas 色键合成器在资源加载时处理，保留黑发、皮肤和衣服；原始图不被覆盖。

这些素材是渲染图，不是可旋转的 3D/VRM 模型。首版 0.1 实现为 **2.5D 合成**：持续呼吸、局部闭眼、口型演示、姿态短过渡与随鼠标方向的轻微整体偏移。它不能提供视频中完整连续的骨骼动作、真实下蹲或任意视角转身；未把这些能力标记为完成。最终渲染使用完整连续图面，避免分条缩放带来的横向接缝。

## 最终提示词集（内置 imagegen）

### 基础人物生成

Use case: stylized-concept. Create a production-quality character sprite for WallSoul, a desktop digital companion. The input image is only a visual style and character reference; REMOVE the Windows desktop, icons, taskbar, music player and all UI. Generate ONE clean isolated waist-up portrait of an adult young East Asian woman, exquisite high-end 3D digital-human rendering matching the reference's quality: short glossy black bob slightly longer on one side, subtle warm auburn tips, soft expressive brown eyes, refined realistic stylized facial anatomy, subtle skin translucency and pores, small silver ear cuff, black long-sleeve ribbed scoop-neck sweater. Front-facing with very slight natural three-quarter asymmetry, looking gently at viewer, mouth closed, calm friendly expression, shoulders relaxed, arms naturally down, both shoulders and full hairstyle uncut. Crop at hips at bottom, top of head with 5% breathing room; character fills most of a 1024x1536 portrait canvas. Consistent soft key light upper left and subtle blue/magenta edge lighting as in reference. This is a beautiful believable 3D rendered virtual person, NOT chibi, NOT flat vector, NOT anime cel shading, NOT a tiny full-body mascot. Genuinely transparent alpha background, not a checkerboard illustration; no backdrop, no shadows outside character, no text, no logo, no watermark. Keep hands out of crop for this neutral base pose. Deliver a high-resolution PNG suitable for compositing over a separate desktop background.

### 素材背景修正

Use case: precise-object-edit. Edit target is the attached portrait. Preserve the exact woman, face, pose, hair, clothing, lighting, camera, framing, proportions, position and 1024x1536 resolution. Replace ONLY the checkerboard background with an absolutely uniform solid RGB (0,255,0) pure chroma-key green background. No checkerboard anywhere, no transparency simulation, no gradient, no pattern, no ground shadow. Green screen must be flat and absolutely uniform all around the person's silhouette. Do not tint the person green and do not add green light spill. Keep the complete woman exactly aligned with the original image; neutral closed lips and open eyes. This image will be used as a chroma-key sprite in a Canvas renderer.

### 闭眼

Use case: identity-preserve. Production animation sprite edit. Change ONLY the eyelids of the woman in this exact image: both eyes gently fully closed in a natural blink, eyelash line relaxed. Preserve exact head position, facial identity, hairstyle silhouette, neck, mouth, shoulders, body, clothing, lighting, all dimensions and solid green background. Same 1024x1536 image. Every part outside the eye regions should remain aligned and unchanged. Do NOT tilt the head, smile more, change mouth shape, zoom, crop, or alter the camera. Flat pure RGB 0,255,0 backdrop remains unchanged. This is a blink animation frame to overlay on the neutral frame, so pixel alignment is critical.

### 口型

Use case: identity-preserve. Edit this exact 1024x1536 character sprite. Change ONLY her lips/mouth region: natural lightly open speaking mouth, a small opening, visible upper teeth and warm inside mouth, tasteful friendly speaking expression. Eyes remain open and exactly the same. Preserve pixel alignment of head position, face identity, hair outline, body, sweater, lighting, camera, canvas size, and flat pure chroma-key green backdrop. Do not move the head or body, no new gesture, no camera change. All regions other than the mouth should remain unchanged. This is a speaking-mouth animation frame for the same digital companion, not a new portrait.

### 托腮

Use case: identity-preserve. Create a matching alternate pose for this same 3D digital woman, same 1024x1536 portrait canvas and flat RGB 0,255,0 green screen. Preserve her exact identity, short glossy black bob with subtle auburn tips, black ribbed long-sleeve sweater, rendering quality, studio lighting and scale. Her head and shoulders remain in nearly the same location. New pose: she thoughtfully and naturally rests her chin lightly on the back of ONE hand, elbow below the frame, long sweater sleeve covering wrist. Her face subtly tilts toward that hand, her eyes glance gently toward the left, mouth softly closed, warm thoughtful expression. Anatomically correct five-finger hand; the other arm stays relaxed down. Keep head uncut, no text, no UI, no desk, no extra items, no green reflections. This is the thinking/chin-rest pose of the same desktop companion.

### 整理头发

Use case: identity-preserve. Matching alternate pose for the EXACT same 3D digital woman, on exactly the same 1024x1536 portrait canvas and perfectly solid RGB 0,255,0 green screen. Keep identity, hairstyle, black ribbed long-sleeve scoop-neck sweater, scale, rendering and studio lighting consistent. New pose: she is listening attentively, head gently tilted a few degrees, eyes calmly looking to the viewer, warm small smile with closed lips. Her right hand is raised to gently tuck a strand of short hair behind her ear, five anatomically correct fingers, relaxed natural wrist, sleeve covers wrist. Her left arm stays down. Keep hairstyle and shoulders within frame, no added props or text, no UI, no green light on her skin. Elegant and lifelike, not exaggerated. Frame suitable for a digital companion listening/adjusting-hair gesture.

## 0.2 保留原形象的连续动作

新增本机 LivePortrait 离线制作的连续头部与闭眼动作图集，不覆盖原始人物图。原人物外貌仍以 `neutral.png` 为来源，没有使用通用动漫模型替换。详细制作过程、范围、第三方来源和局限见 [original-motion.md](original-motion.md)。这仍不是完整人体 3D 骨骼动画。
