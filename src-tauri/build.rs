fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let out = std::env::var("OUT_DIR").unwrap();
        let arch = if std::env::var("CARGO_CFG_TARGET_ARCH").unwrap() == "aarch64" {
            "arm64"
        } else {
            "x86_64"
        };
        let sdk = std::process::Command::new("xcrun")
            .args(["--sdk", "macosx", "--show-sdk-path"])
            .output()
            .unwrap();
        let sdk = String::from_utf8(sdk.stdout).unwrap();
        let status = std::process::Command::new("xcrun")
            .args([
                "swiftc",
                if std::env::var("PROFILE").as_deref() == Ok("release") {
                    "-O"
                } else {
                    "-Onone"
                },
                "-parse-as-library",
                "-emit-library",
                "-static",
                "-module-name",
                "WallSoulNative",
                "-module-cache-path",
                &format!("{out}/swift-module-cache"),
                "-target",
                &format!("{arch}-apple-macosx14.0"),
                "-sdk",
                sdk.trim(),
                "src/platform/macos/Native.swift",
                "src/platform/macos/AudioReactive.swift",
                "-o",
                &format!("{out}/libWallSoulNative.a"),
            ])
            .status()
            .unwrap();
        assert!(status.success(), "macOS native bridge failed");
        println!("cargo:rustc-link-search=native={out}");
        println!("cargo:rustc-link-search=native=/usr/lib/swift");
        println!("cargo:rustc-link-lib=static=WallSoulNative");
        for framework in [
            "AppKit",
            "Foundation",
            "CoreGraphics",
            "AVFoundation",
            "CoreAudio",
        ] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
        println!("cargo:rerun-if-changed=src/platform/macos/Native.swift");
        println!("cargo:rerun-if-changed=src/platform/macos/AudioReactive.swift");
    }
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "snapshot",
            "action",
            "settings",
            "characters",
            "metrics",
            "audio_action",
            "audio_sources",
        ]),
    ))
    .expect("tauri build");
}
