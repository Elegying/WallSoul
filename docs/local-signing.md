# 开发期间保留 macOS 权限

## 已确认原因

0.3 身体动作候选的 designated requirement 为 `cdhash`，不是稳定的证书身份。重新编译会改变哈希；仅保持 Bundle ID 不足以保留权限。Apple TN3127 明确说明 ad-hoc 签名与具体代码版本绑定，隐私权限依赖兼容的 designated requirement。

参考：https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements

## 当前处理

- 当前已授权的 `artifacts/WallSoul-0.3-body-candidate.app` 保留，未重新签名或替换。再次开始语音没有进入权限等待，输入确实检测到声音，但尚未成功转写中文。
- 本机原先没有可用的代码签名身份。已创建幕灵专用 `WallSoul Local Development` 身份并导入登录钥匙串，私钥不存放于项目；仅允许 codesign 使用，不更改系统信任或 TCC 数据库。
- 机器本地公共引用保存在 `.local-signing.json`，已加入忽略列表。不要删除身份后重新生成，否则又会改变应用身份。
- 用户完成钥匙串确认后，首次签名成功，后续重复签名没有再次等待确认。完整签名及跨构建身份检查均已通过。自动化工具禁止操作 SecurityAgent，不能代填密码。
- `artifacts/WallSoul-Development.app` 是以后固定的开发入口；现已通过签名验证并启动；语音完整闭环仍未验收。

## 后续构建

```sh
npm run tauri build -- --bundles app
python3 scripts/package-local.py
open artifacts/WallSoul-Development.app
```

打包脚本拒绝覆盖正在运行的固定入口；先在临时目录签名、验证证书身份和完整性，再替换固定路径。没有身份记录时明确失败，不悄悄回退临时签名。

初始化只执行一次：`python3 scripts/setup-local-signing.py`。已有记录时拒绝重新创建。该脚本不安装信任根、不修改其他应用的权限。此证书用于本机开发身份，不能代替 Apple Developer ID 或公证。

## 验证门槛

首次建立稳定身份后仍可能需要系统确认。完成确认后应验证：

1. 签名完整性通过，DR 绑定证书而非 cdhash。
2. 两个内容不同、同证书签名的构建，互相满足相同的 DR。
3. 首次麦克风/语音识别授权后，退出重开及同身份更新不重复申请权限。

第 1–2 项已通过 scripts/check-local-signing.py 验证；第 3 项也已实测：固定签名首次获准后，退出重开直接 listening；随后新增构建记录资源、重新签名替换固定入口，再次直接 listening，无权限等待。此结果支持正常开发更新保留授权，不表示系统权限永远不能失效。用户撤销权限、系统重置权限、改用其他签名身份仍可能要求重新确认。

本轮还实际观察到识别“你好” → 模型回复“你好！有什么可以帮助你的吗？” → speaking → 自动回到 listening。合成测试整句没有完整识别，不能当作中文识别准确率已通过。停止按钮后返回待机且结束采集。
