use super::*;
pub struct Native;
impl WallpaperHost for Native {
    fn attach(_: &tauri::WebviewWindow, _: u32) -> Result<(), String> {
        Err("Unsupported：Windows 桌面宿主尚未实现，当前仅支持窗口预览。".into())
    }
    fn detach() {}
}
impl SystemEvents for Native {
    fn system() -> Result<SystemInfo, String> {
        Ok(SystemInfo::default())
    }
    fn observe() {}
    fn cleanup() {}
}

impl Native {
    pub fn audio(_: &str, _: &str) -> Result<serde_json::Value, String> {
        Err("Unsupported：此平台音频跟随尚未实现".into())
    }
}
