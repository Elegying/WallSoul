use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Screen {
    pub id: u32,
    pub name: String,
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub suspended: bool,
    pub screens: Vec<Screen>,
    pub desktop: Option<DesktopInfo>,
    pub pointer: Option<PointerInfo>,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct PointerInfo {
    pub x: f64,
    pub y: f64,
    pub screen: u32,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInfo {
    pub level: i64,
    pub mouse_pass: bool,
    pub can_become_key: bool,
    pub visible: bool,
    pub occluded: bool,
    pub width: f64,
    pub height: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub character: String,
    pub screen: u32,
    pub x: f64,
    pub y: f64,
    pub size: f64,
    pub low_power: bool,
    pub mode: String,
    pub demo_pose: String,
    #[serde(default = "default_motion")]
    pub motion: String,
    pub application: String,
    #[serde(default)]
    pub audio_source: String,
    #[serde(default = "default_mic_threshold")]
    pub mic_threshold_db: f64,
}
fn default_mic_threshold() -> f64 {
    -38.0
}
fn default_motion() -> String {
    "auto".into()
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            character: "soul".into(),
            screen: 0,
            x: 0.65,
            y: 0.58,
            size: 0.9,
            low_power: false,
            mode: "manual".into(),
            demo_pose: "idle".into(),
            motion: default_motion(),
            application: String::new(),
            audio_source: String::new(),
            mic_threshold_db: default_mic_threshold(),
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if self.audio_source.len() > 256
            || self.audio_source.chars().any(char::is_control)
            || !self.mic_threshold_db.is_finite()
            || !(-60.0..=-25.0).contains(&self.mic_threshold_db)
        {
            return Err("音频来源或麦克风阈值无效。".into());
        }
        if !self.x.is_finite()
            || !self.y.is_finite()
            || !self.size.is_finite()
            || !(0.15..=0.85).contains(&self.x)
            || !(0.35..=0.8).contains(&self.y)
            || !(0.4..=1.4).contains(&self.size)
        {
            return Err("人物位置或大小超出范围。".into());
        }
        if self.motion.is_empty()
            || self.motion.len() > 40
            || !self
                .motion
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b == b'-')
        {
            return Err("人物动作标识无效。".into());
        }
        if !["manual", "demo"].contains(&self.mode.as_str())
            || !["idle", "listening", "thinking", "speaking"].contains(&self.demo_pose.as_str())
        {
            return Err("不支持的模式。".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WallpaperState {
    Preview,
    Running,
    Paused,
    Suspended,
    Error,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub audio: crate::audio::AudioState,
    pub session_id: String,
    pub sequence: u64,
    pub wallpaper: WallpaperState,
    pub settings: Settings,
    pub system: SystemInfo,
    pub message: String,
    pub recovery_warning: bool,
    pub logs: Vec<String>,
    pub metrics: std::collections::BTreeMap<String, RenderMetrics>,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackMetrics {
    pub clip: String,
    pub displayed_index: i32,
    pub rendered_frames: u64,
    pub waiting_frames: u64,
    pub cached_frames: usize,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RenderMetrics {
    pub playback: Option<PlaybackMetrics>,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
}
pub struct Engine {
    pub view: Snapshot,
    pub quitting: bool,
    pub wallpaper_requested: bool,
    pub paused: bool,
}
impl Engine {
    pub fn update_metrics(&mut self, window: &str, value: RenderMetrics) -> bool {
        if !value.fps.is_finite()
            || !(0. ..=120.).contains(&value.fps)
            || value.width > 4096
            || value.height > 4096
            || self.view.metrics.get(window) == Some(&value)
        {
            return false;
        }
        self.view.metrics.insert(window.into(), value);
        self.changed("");
        true
    }
    pub fn new(mut settings: Settings, recovery: bool) -> Self {
        settings.application.clear();
        settings.mode = "manual".into();
        Self {
            view: Snapshot {
                audio: Default::default(),
                session_id: Uuid::new_v4().to_string(),
                sequence: 0,
                wallpaper: WallpaperState::Preview,
                settings,
                system: Default::default(),
                message: String::new(),
                recovery_warning: recovery,
                logs: vec![],
                metrics: Default::default(),
            },
            quitting: false,
            wallpaper_requested: false,
            paused: false,
        }
    }
    pub fn changed(&mut self, note: &str) {
        self.view.sequence += 1;
        if !note.is_empty() {
            self.view
                .logs
                .push(format!("{} · {}", self.view.sequence, note));
            if self.view.logs.len() > 60 {
                self.view.logs.remove(0);
            }
        }
    }
    pub fn cancel(&mut self) {
        self.changed("");
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_paused_metrics_do_not_create_a_snapshot_feedback_loop() {
        let mut engine = Engine::new(Settings::default(), false);
        let paused = RenderMetrics {
            fps: 0.,
            width: 1440,
            height: 900,
            playback: Some(PlaybackMetrics {
                rendered_frames: 5866,
                ..Default::default()
            }),
        };
        assert!(engine.update_metrics("wallpaper", paused.clone()));
        let revision = engine.view.sequence;
        for _ in 0..1000 {
            assert!(!engine.update_metrics("wallpaper", paused.clone()));
        }
        assert_eq!(engine.view.sequence, revision);
        assert!(engine.update_metrics("main", RenderMetrics::default()));
        let resumed = RenderMetrics {
            fps: 30.,
            ..paused.clone()
        };
        assert!(engine.update_metrics("wallpaper", resumed));
        assert!(engine.update_metrics("wallpaper", paused));
        assert!(!engine.update_metrics(
            "wallpaper",
            RenderMetrics {
                fps: f64::NAN,
                ..Default::default()
            }
        ));
    }
    #[test]
    fn migrates_to_passive_audio_without_auto_capture() {
        let e = Engine::new(
            Settings {
                application: "old Doubao path".into(),
                mode: "demo".into(),
                ..Default::default()
            },
            true,
        );
        assert!(!e.view.audio.enabled);
        assert_eq!(e.view.audio.phase, "idle");
        assert!(e.view.settings.application.is_empty());
        assert_eq!(e.view.settings.mode, "manual");
    }
    #[test]
    fn rejects_invalid_settings() {
        let s = Settings {
            x: f64::NAN,
            ..Settings::default()
        };
        assert!(s.validate().is_err());
    }
    #[test]
    fn audio_preferences_migrate_and_survive_restart_without_starting_capture() {
        let mut legacy = serde_json::to_value(Settings::default()).unwrap();
        legacy.as_object_mut().unwrap().remove("audioSource");
        legacy.as_object_mut().unwrap().remove("micThresholdDb");
        let migrated: Settings = serde_json::from_value(legacy).unwrap();
        assert_eq!(migrated.mic_threshold_db, -38.0);
        assert!(migrated.audio_source.is_empty());
        let preferences = Settings {
            audio_source: "com.example.voice".into(),
            mic_threshold_db: -45.0,
            ..migrated
        };
        let saved: Settings =
            serde_json::from_slice(&serde_json::to_vec(&preferences).unwrap()).unwrap();
        let engine = Engine::new(saved, false);
        assert_eq!(engine.view.settings.audio_source, "com.example.voice");
        assert_eq!(engine.view.settings.mic_threshold_db, -45.0);
        assert!(!engine.view.audio.enabled);
        for threshold in [f64::NAN, -61.0, -24.0] {
            assert!(Settings {
                mic_threshold_db: threshold,
                ..preferences.clone()
            }
            .validate()
            .is_err());
        }
    }
}
