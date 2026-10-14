use crate::core::SystemInfo;
pub trait WallpaperHost {
    fn attach(window: &tauri::WebviewWindow, screen: u32) -> Result<(), String>;
    fn detach();
}
pub trait SystemEvents {
    fn system() -> Result<SystemInfo, String>;
    fn observe();
    fn cleanup();
}
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::Native;
#[cfg(not(target_os = "macos"))]
mod windows;
#[cfg(not(target_os = "macos"))]
pub use windows::Native;
