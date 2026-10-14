pub mod audio;
mod bundle_assets;
pub mod core;
mod platform;
use core::*;
use platform::*;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{Emitter, Manager};
struct AppState {
    engine: Mutex<Engine>,
    folder: std::path::PathBuf,
    stop: Arc<AtomicBool>,
}
fn publish(app: &tauri::AppHandle, e: &Engine) {
    let _ = app.emit("session", &e.view);
}
#[tauri::command]
fn snapshot(state: tauri::State<AppState>) -> Snapshot {
    state.engine.lock().unwrap().view.clone()
}
#[tauri::command]
fn characters() -> serde_json::Value {
    serde_json::from_str(include_str!("../../resources/characters/catalog.json")).unwrap()
}
#[tauri::command]
fn metrics(window: tauri::WebviewWindow, state: tauri::State<AppState>, value: RenderMetrics) {
    let mut engine = state.engine.lock().unwrap();
    // A paused renderer receives this same snapshot. Unchanged telemetry must
    // not publish another revision and feed back through every WebView.
    if engine.update_metrics(window.label(), value) {
        publish(window.app_handle(), &engine);
    }
}
fn save(s: &AppState, settings: &Settings) -> Result<(), String> {
    let path = s.folder.join("settings.json");
    let tmp = s.folder.join("settings.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(settings).unwrap())
        .map_err(|_| "设置保存失败，请检查磁盘空间。")?;
    std::fs::rename(tmp, path).map_err(|_| "设置保存失败。".into())
}
#[tauri::command]
fn settings(app: tauri::AppHandle, value: Settings) -> Result<(), String> {
    value.validate()?;
    let catalog = characters();
    if !catalog
        .as_array()
        .unwrap()
        .iter()
        .any(|c| c["id"] == value.character)
    {
        return Err("角色包不存在。".into());
    }
    let s = app.state::<AppState>();
    let mut e = s.engine.lock().unwrap();
    save(&s, &value)?;
    e.view.settings = value;
    e.changed("更新本地设置");
    publish(&app, &e);
    Ok(())
}
fn show_panel(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
fn wallpaper(app: &tauri::AppHandle) -> Result<(), String> {
    let screen = {
        let s = app.state::<AppState>();
        let e = s.engine.lock().unwrap();
        if e.view.system.suspended {
            return Err("系统正在休息，请唤醒后再开启壁纸。".into());
        }
        let selected = e.view.settings.screen;
        e.view
            .system
            .screens
            .iter()
            .find(|s| s.id == selected)
            .or(e.view.system.screens.first())
            .map(|s| s.id)
            .ok_or("没有可用屏幕；请使用窗口预览。")?
    };
    let w = if let Some(w) = app.get_webview_window("wallpaper") {
        w
    } else {
        tauri::WebviewWindowBuilder::new(
            app,
            "wallpaper",
            tauri::WebviewUrl::App("index.html?wallpaper=1".into()),
        )
        .title("幕灵 · 桌面场景")
        .decorations(false)
        .visible(false)
        .focused(false)
        .focusable(false)
        .skip_taskbar(true)
        .resizable(false)
        .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
        .build()
        .map_err(|e| e.to_string())?
    };
    w.set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    if let Err(error) = Native::attach(&w, screen) {
        let _ = w.close();
        return Err(error);
    }
    Ok(())
}
#[tauri::command]
async fn action(app: tauri::AppHandle, name: String) -> Result<(), String> {
    // All window mutations are marshalled onto AppKit's main thread.
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    let a = app.clone();
    app.run_on_main_thread(move || {
        let result = action_main(&a, &name);
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_secs(8))
            .map_err(|_| "系统操作超时，请重新检测。".to_string())?
    })
    .await
    .map_err(|e| e.to_string())?
}
fn action_main(app: &tauri::AppHandle, name: &str) -> Result<(), String> {
    let s = app.state::<AppState>();
    match name {
        "wallpaper" => {
            let result = wallpaper(app);
            let mut e = s.engine.lock().unwrap();
            match result {
                Ok(()) => {
                    e.wallpaper_requested = true;
                    e.paused = false;
                    e.view.wallpaper = WallpaperState::Running;
                    e.view.message = "桌面场景已开启。音频跟随需主动开启。".into()
                }
                Err(err) => {
                    e.view.wallpaper = WallpaperState::Error;
                    e.view.message = err.clone();
                    e.changed("桌面适配失败");
                    publish(app, &e);
                    return Err(err);
                }
            }
            e.changed("开启桌面窗口");
            publish(app, &e);
        }
        "stop" => {
            if let Some(w) = app.get_webview_window("wallpaper") {
                Native::detach();
                w.close().map_err(|e| e.to_string())?;
            }
            let mut e = s.engine.lock().unwrap();
            e.wallpaper_requested = false;
            e.paused = false;
            e.view.wallpaper = WallpaperState::Preview;
            e.changed("移除桌面窗口");
            publish(app, &e);
        }
        "pause" | "resume" => {
            let mut e = s.engine.lock().unwrap();
            e.paused = name == "pause";
            e.view.wallpaper = if e.view.system.suspended {
                WallpaperState::Suspended
            } else if e.paused {
                WallpaperState::Paused
            } else if e.wallpaper_requested {
                WallpaperState::Running
            } else {
                WallpaperState::Preview
            };
            e.changed("调整画面暂停状态");
            publish(app, &e);
        }
        "cancel" => {
            let mut e = s.engine.lock().unwrap();
            e.cancel();
            publish(app, &e);
        }
        "dismissRecovery" => {
            let mut e = s.engine.lock().unwrap();
            e.view.recovery_warning = false;
            e.changed("");
            publish(app, &e);
        }
        "quit" => quit(app),
        "forceQuit" => quit(app),
        _ => return Err("不支持此操作。".into()),
    }
    Ok(())
}
fn quit(app: &tauri::AppHandle) {
    audio::stop(app);
    let s = app.state::<AppState>();
    {
        let mut e = s.engine.lock().unwrap();
        e.cancel();
        e.quitting = true;
    }
    s.stop.store(true, Ordering::Release);
    Native::cleanup();
    let _ = std::fs::remove_file(s.folder.join("running"));
    app.exit(0);
}
fn tick(app: &tauri::AppHandle) {
    let Ok(system) = Native::system() else { return };
    let s = app.state::<AppState>();
    let mut e = s.engine.lock().unwrap();
    let changed = system != e.view.system;
    let was_suspended = e.view.system.suspended;
    let previous_screens = e.view.system.screens.clone();
    e.view.system = system;
    if !e
        .view
        .system
        .screens
        .iter()
        .any(|s| s.id == e.view.settings.screen)
    {
        if let Some(screen) = e.view.system.screens.first() {
            e.view.settings.screen = screen.id;
        }
    }
    let suspended = e.view.system.suspended;
    if suspended && !was_suspended {
        e.cancel();
        e.view.wallpaper = WallpaperState::Suspended;
    }
    let remount = e.wallpaper_requested
        && !suspended
        && (was_suspended || previous_screens != e.view.system.screens);
    if !suspended && was_suspended {
        e.view.wallpaper = if e.paused {
            WallpaperState::Paused
        } else if e.wallpaper_requested {
            WallpaperState::Running
        } else {
            WallpaperState::Preview
        };
    }
    if changed {
        let note = if was_suspended != suspended || previous_screens != e.view.system.screens {
            "系统显示状态变化"
        } else {
            ""
        };
        e.changed(note);
        publish(app, &e);
    }
    drop(e);
    if remount {
        if let Err(error) = wallpaper(app) {
            let mut e = s.engine.lock().unwrap();
            e.view.wallpaper = WallpaperState::Error;
            e.view.message = error;
            e.changed("屏幕迁移失败");
            publish(app, &e);
        }
    }
}
pub fn run() {
    let mut context = tauri::generate_context!();
    bundle_assets::install(&mut context);
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_panel(app)
        }))
        .setup(|app| {
            let folder = app.path().app_config_dir()?;
            std::fs::create_dir_all(&folder)?;
            let loaded = std::fs::read(folder.join("settings.json"))
                .ok()
                .and_then(|v| serde_json::from_slice::<Settings>(&v).ok())
                .filter(|s| s.validate().is_ok())
                .unwrap_or_default();
            let recovery = folder.join("running").exists();
            std::fs::write(
                folder.join("running"),
                b"audio capture does not resume after restart",
            )?;
            let stop = Arc::new(AtomicBool::new(false));
            app.manage(AppState {
                engine: Mutex::new(Engine::new(loaded, recovery)),
                folder,
                stop: stop.clone(),
            });
            Native::observe();
            tick(app.handle());
            use tauri::menu::{Menu, MenuItem};
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{AboutMetadata, PredefinedMenuItem, Submenu};
                let open_panel =
                    MenuItem::with_id(app, "app-panel", "打开幕灵", true, Some("CmdOrCtrl+1"))?;
                // The native predefined terminate action can bypass our clean shutdown.
                // Route Command-Q through the same audio/desktop cleanup as the panel.
                let quit_item =
                    MenuItem::with_id(app, "app-quit", "退出幕灵", true, Some("CmdOrCtrl+Q"))?;
                let app_menu = Submenu::with_items(
                    app,
                    "幕灵",
                    true,
                    &[
                        &PredefinedMenuItem::about(
                            app,
                            Some("关于幕灵"),
                            Some(AboutMetadata {
                                name: Some("幕灵 · WallSoul".into()),
                                version: Some(env!("CARGO_PKG_VERSION").into()),
                                ..Default::default()
                            }),
                        )?,
                        &PredefinedMenuItem::separator(app)?,
                        &open_panel,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, Some("隐藏幕灵"))?,
                        &PredefinedMenuItem::hide_others(app, Some("隐藏其他应用"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &quit_item,
                    ],
                )?;
                let native_menu = Menu::default(app.handle())?;
                native_menu.remove_at(0)?;
                native_menu.prepend(&app_menu)?;
                app.set_menu(native_menu)?;
                app.on_menu_event(|app, event| match event.id.as_ref() {
                    "app-panel" => show_panel(app),
                    "app-quit" => quit(app),
                    _ => {}
                });
            }
            let panel = MenuItem::with_id(app, "panel", "打开幕灵", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "暂停画面", true, None::<&str>)?;
            let resume = MenuItem::with_id(app, "resume", "恢复画面", true, None::<&str>)?;
            let stopitem = MenuItem::with_id(app, "stop", "停止壁纸", true, None::<&str>)?;
            let voice_stop = MenuItem::with_id(
                app,
                "voiceStop",
                "停止音频跟随 / 结束采集",
                true,
                None::<&str>,
            )?;
            let exit = MenuItem::with_id(app, "quit", "退出幕灵", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&panel, &voice_stop, &pause, &resume, &stopitem, &exit],
            )?;
            tauri::tray::TrayIconBuilder::with_id("wallsoul")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/tray.png"
                ))?)
                .icon_as_template(true)
                .tooltip("幕灵 · WallSoul")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "panel" {
                        show_panel(app)
                    } else if event.id.as_ref() == "voiceStop" {
                        audio::stop(app);
                    } else {
                        let _ = action_main(app, event.id.as_ref());
                    }
                })
                .build(app)?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut next_system_poll = std::time::Instant::now();
                while !stop.load(Ordering::Acquire) {
                    let audio_interval = handle
                        .state::<AppState>()
                        .engine
                        .lock()
                        .unwrap()
                        .view
                        .audio
                        .poll_interval();
                    let now = std::time::Instant::now();
                    let system_due = now >= next_system_poll;
                    if system_due || audio_interval.is_some() {
                        let a = handle.clone();
                        let _ = handle.run_on_main_thread(move || {
                            if audio_interval.is_some() {
                                audio::tick(&a);
                            }
                            if system_due {
                                tick(&a);
                            }
                        });
                    }
                    if system_due {
                        next_system_poll = now + std::time::Duration::from_secs(1);
                    }
                    // A new user-authorized capture is noticed within 250 ms while idle.
                    std::thread::sleep(
                        audio_interval.unwrap_or(std::time::Duration::from_millis(250)),
                    );
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            action,
            settings,
            characters,
            metrics,
            audio::audio_action,
            audio::audio_sources
        ])
        .build(context)
        .expect("启动幕灵失败")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = &event {
                show_panel(app);
            }
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<AppState>().stop.load(Ordering::Acquire) {
                    api.prevent_exit();
                    let _ = action_main(app, "quit");
                }
            }
        });
}
