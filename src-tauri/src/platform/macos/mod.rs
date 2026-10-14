use super::*;
use std::ffi::{c_char, c_void, CStr, CString};
pub struct Native;
extern "C" {
    fn ws_audio(command: *const c_char, input: *const c_char) -> *mut c_char;
    fn ws_free(ptr: *mut c_char);
    fn ws_desktop(ptr: *mut c_void, screen: u32) -> bool;
    fn ws_system() -> *mut c_char;
    fn ws_detach();
    fn ws_observe();
    fn ws_cleanup();
}
unsafe fn json<T: serde::de::DeserializeOwned>(ptr: *mut c_char) -> Result<T, String> {
    if ptr.is_null() {
        return Err("系统查询未返回结果，请重新检测。".into());
    }
    let result = serde_json::from_slice(CStr::from_ptr(ptr).to_bytes()).map_err(|e| e.to_string());
    ws_free(ptr);
    result
}
impl WallpaperHost for Native {
    fn attach(window: &tauri::WebviewWindow, screen: u32) -> Result<(), String> {
        let ptr = window.ns_window().map_err(|e| e.to_string())?;
        if unsafe { ws_desktop(ptr, screen) } {
            Ok(())
        } else {
            Err("桌面层验证失败，请使用窗口预览并重新选择屏幕。".into())
        }
    }
    fn detach() {
        unsafe { ws_detach() }
    }
}
impl SystemEvents for Native {
    fn system() -> Result<SystemInfo, String> {
        unsafe { json(ws_system()) }
    }
    fn observe() {
        unsafe { ws_observe() }
    }
    fn cleanup() {
        unsafe { ws_cleanup() }
    }
}

impl Native {
    pub fn audio(command: &str, input: &str) -> Result<serde_json::Value, String> {
        let command = CString::new(command).map_err(|_| "语音指令无效")?;
        let input = CString::new(input).map_err(|_| "语音文本无效")?;
        unsafe { json(ws_audio(command.as_ptr(), input.as_ptr())) }
    }
}
