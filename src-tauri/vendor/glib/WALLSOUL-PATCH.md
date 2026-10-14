# WallSoul 中的 glib 安全补丁

此目录来自 crates.io 的 `glib 0.18.5` 原始发布包，保留上游 MIT 许可证及版本号。

- 原始包：<https://static.crates.io/crates/glib/glib-0.18.5.crate>
- SHA-256：`233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`
- 原始源码提交：`42b9caf98e03ded086362d9653ca58fe94dc8658`
- 上游修复：<https://github.com/gtk-rs/gtk-rs-core/pull/1343>
- 修复提交：`b5a4071e439bef2b5eea76c3aa25e5ae84839e34`
- 告警：`GHSA-wrw7-89jp-8q8g` / `RUSTSEC-2024-0429`

相对原始发布包，除本文外只修改 `src/variant_iter.rs` 的两行，与上游修复一致：

```diff
-            let p: *mut libc::c_char = std::ptr::null_mut();
+            let mut p: *mut libc::c_char = std::ptr::null_mut();
...
-                &p,
+                &mut p,
```

`g_variant_get_child` 会写入输出指针，必须传入可变引用；旧代码在优化编译时会产生未定义行为。
GTK 0.18 的依赖约束不能接受 glib 0.20，因此通过根 `Cargo.toml` 的 `[patch.crates-io]`
使用这一份已修补的本地源码。没有伪造 0.20 版本号，也没有添加安全告警忽略项。

回归测试位于 `../../security-tests`，必须使用 release 模式执行。后续 Tauri/GTK 依赖链
能够使用官方修复版本时，移除本目录及 patch，并让回归测试改为验证新的官方依赖。

版本扫描工具可能仍依据 `0.18.5` 报警；应检查实际解析来源与上述补丁，不能把本地回移
描述为上游已经发布了兼容修复版本。
