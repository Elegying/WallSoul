# 依赖安全修复与验证

2026-10-14 处理 WallSoul 的两条 Dependabot 告警。

## source-map-js

`GHSA-68fv-2mgg-jv7q` / `CVE-2026-93749` 来自 Vite → PostCSS → source-map-js。
锁文件将 `source-map-js` 从 1.2.1 更新为官方修复版 1.2.2，其他 npm 依赖保持原锁定版本。
`tests/dependency-security.test.ts` 通过 PostCSS 的实际模块解析路径，验证超大偏移、嵌套偏移
被拒绝，以及正常 source map 的映射仍然正确。

上游修复：<https://github.com/7rulnik/source-map-js/pull/79>。

## glib

`GHSA-wrw7-89jp-8q8g` / `RUSTSEC-2024-0429` 来自 Tauri 的 GTK 依赖链。
GTK 0.18 要求 glib 0.18，无法直接换成修复该问题的官方 glib 0.20。
因此保留 0.18.5 API，回移上游的两行指针可变性修复，并通过 `[patch.crates-io]`
解析到仓库中的 `src-tauri/vendor/glib`。来源、原包校验值及精确差异见
[补丁说明](../src-tauri/vendor/glib/WALLSOUL-PATCH.md)。

`wallsoul-dependency-tests` 是独立的测试包，覆盖 `next`、`next_back`、`nth`、`nth_back`、
`last`、UTF-8、空字符串和空迭代器。CI 在 Linux 上以 release 模式运行，因为漏洞与优化
有关；它验证修补依赖，不表示 WallSoul 已获得 Linux 应用支持。桌面默认构建仍只选中
WallSoul，macOS 和 Windows 的运行依赖不会因测试而引入 GLib。

本地对照使用 Rust 1.98.0、macOS 和系统 GLib 2.90.1：同一组测试在未修补的官方
glib 0.18.5 上以 `SIGSEGV` 退出，应用这两行补丁后 3 项全部通过。source-map-js 1.2.1
也未能通过超大偏移拒绝断言；1.2.2 通过新增回归测试。这些是代码回归证据，未更新已安装
应用，也不替代桌面功能与长时间运行验收。

```sh
# macOS 测试环境：brew install glib
# Debian/Ubuntu 测试环境：sudo apt-get install libglib2.0-dev pkg-config
cargo test --locked --release --manifest-path src-tauri/Cargo.toml -p wallsoul-dependency-tests
npm ci
npm test
npm run build:desktop
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings
```

只按版本匹配的扫描器可能仍将本地 glib 0.18.5 标记为受影响，应同时核对解析来源与实际补丁。
后续上游提供兼容的官方修复依赖链时，移除回移副本与 patch，更新测试依赖并重新跑完整 CI。
