use crate::{platform::Native, publish, AppState};
use serde::{Deserialize, Serialize};
use tauri::Manager;
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioState {
    pub phase: String,
    pub enabled: bool,
    pub source: String,
    pub emotion: String,
    pub level: f64,
    pub input_level: f64,
    pub output_level: f64,
    #[serde(default)]
    pub brightness: f64,
    pub error: String,
}
impl Default for AudioState {
    fn default() -> Self {
        Self {
            phase: "idle".into(),
            enabled: false,
            source: String::new(),
            emotion: "neutral".into(),
            level: 0.,
            input_level: 0.,
            output_level: 0.,
            brightness: 0.,
            error: String::new(),
        }
    }
}
impl AudioState {
    pub fn poll_interval(&self) -> Option<std::time::Duration> {
        (self.enabled || self.phase == "permission").then_some(std::time::Duration::from_millis(50))
    }
}
#[tauri::command]
pub async fn audio_sources(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(Native::audio("sources", ""));
    })
    .map_err(|e| e.to_string())?;
    rx.await.map_err(|_| "音频来源查询已取消".to_string())?
}
#[tauri::command]
pub async fn audio_action(
    app: tauri::AppHandle,
    command: String,
    source: Option<String>,
    mic_threshold_db: Option<f64>,
) -> Result<(), String> {
    if command != "start" && command != "stop" {
        return Err("不支持的音频操作".into());
    }
    let source = source.unwrap_or_default();
    let threshold = mic_threshold_db.unwrap_or(-38.);
    if source.len() > 240
        || source.contains('\0')
        || !threshold.is_finite()
        || !(-60. ..=-25.).contains(&threshold)
    {
        return Err("音频来源或灵敏度无效".into());
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    let a = app.clone();
    app.run_on_main_thread(move || {
        let s = a.state::<AppState>();
        let mut e = s.engine.lock().unwrap();
        let result = if command == "start" && (e.quitting || e.view.system.suspended) {
            Err("请唤醒系统后开始跟随".into())
        } else {
            Native::audio(
                &command,
                &serde_json::json!({"source":source,"micThresholdDb":threshold}).to_string(),
            )
            .and_then(|value| {
                serde_json::from_value::<AudioState>(value).map_err(|err| err.to_string())
            })
            .map(|state| {
                e.view.audio = state;
                e.changed("");
                publish(&a, &e);
            })
        };
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    rx.await.map_err(|_| "音频操作已取消".to_string())?
}
pub fn stop(app: &tauri::AppHandle) {
    let _ = Native::audio("stop", "");
    let s = app.state::<AppState>();
    let mut e = s.engine.lock().unwrap();
    e.view.audio = AudioState::default();
    e.changed("");
    publish(app, &e);
}
pub fn tick(app: &tauri::AppHandle) {
    let s = app.state::<AppState>();
    let mut e = s.engine.lock().unwrap();
    if e.view.audio.poll_interval().is_none() {
        return;
    }
    let next = Native::audio("status", "")
        .and_then(|v| serde_json::from_value::<AudioState>(v).map_err(|err| err.to_string()));
    let next = match next {
        Ok(next) => next,
        Err(error) => {
            let _ = Native::audio("stop", "");
            e.changed(&format!("音频状态读取失败：{error}"));
            AudioState {
                phase: "error".into(),
                source: e.view.audio.source.clone(),
                error: "音频状态读取失败，采集已停止。请重新开始跟随。".into(),
                ..AudioState::default()
            }
        }
    };
    if e.view.audio != next {
        e.view.audio = next;
        e.changed("");
        publish(app, &e);
    }
}

#[cfg(test)]
mod tests {
    use super::AudioState;

    #[test]
    fn only_authorization_and_active_capture_require_audio_polling() {
        let mut audio = AudioState::default();
        assert_eq!(audio.poll_interval(), None);
        audio.phase = "permission".into();
        assert_eq!(audio.poll_interval().unwrap().as_millis(), 50);
        audio.phase = "monitoring".into();
        audio.enabled = true;
        assert_eq!(audio.poll_interval().unwrap().as_millis(), 50);
        audio.enabled = false;
        audio.phase = "error".into();
        assert_eq!(audio.poll_interval(), None);
        assert_eq!(AudioState::default().poll_interval(), None);
    }
}
