use std::{
    borrow::Cow,
    path::{Component, Path, PathBuf},
    sync::OnceLock,
};
use tauri::{
    utils::assets::{AssetKey, AssetsIter, CspHash},
    Assets, Manager, Runtime,
};

// Character files remain signed bundle resources instead of enormous Rust constants.
pub struct BundleAssets<R: Runtime> {
    embedded: Option<Box<dyn Assets<R>>>,
    root: OnceLock<PathBuf>,
}
fn read_character(root: &Path, relative: &str) -> Option<Vec<u8>> {
    let path = Path::new(relative);
    if relative.is_empty() || !path.components().all(|c| matches!(c, Component::Normal(_))) {
        return None;
    }
    let root = root.canonicalize().ok()?;
    let file = root.join(path).canonicalize().ok()?;
    if !file.starts_with(&root) || !file.is_file() || file.metadata().ok()?.len() > 64 * 1024 * 1024
    {
        return None;
    }
    std::fs::read(file).ok()
}
impl<R: Runtime> Assets<R> for BundleAssets<R> {
    fn setup(&self, app: &tauri::App<R>) {
        if let Some(embedded) = &self.embedded {
            embedded.setup(app);
        }
        if let Ok(root) = app.path().resource_dir() {
            let _ = self.root.set(root.join("characters"));
        }
    }
    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        if let Some(relative) = key.as_ref().strip_prefix("/characters/") {
            return read_character(self.root.get()?, relative).map(Cow::Owned);
        }
        self.embedded.as_ref()?.get(key)
    }
    fn iter(&self) -> Box<AssetsIter<'_>> {
        self.embedded
            .as_ref()
            .map(|a| a.iter())
            .unwrap_or_else(|| Box::new(std::iter::empty()))
    }
    fn csp_hashes(&self, key: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        self.embedded
            .as_ref()
            .map(|a| a.csp_hashes(key))
            .unwrap_or_else(|| Box::new(std::iter::empty()))
    }
}
pub fn install<R: Runtime>(context: &mut tauri::Context<R>) {
    let previous = context.set_assets(Box::new(BundleAssets {
        embedded: None,
        root: OnceLock::new(),
    }));
    context.set_assets(Box::new(BundleAssets {
        embedded: Some(previous),
        root: OnceLock::new(),
    }));
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundle_files_are_local_and_cannot_escape() {
        let root = std::env::temp_dir().join(format!("wallsoul-assets-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("characters/soul")).unwrap();
        std::fs::write(root.join("characters/soul/frame.png"), b"frame").unwrap();
        std::fs::write(root.join("private.txt"), b"private").unwrap();
        let chars = root.join("characters");
        assert_eq!(
            read_character(&chars, "soul/frame.png"),
            Some(b"frame".to_vec())
        );
        assert!(read_character(&chars, "../private.txt").is_none());
        assert!(read_character(&chars, "/private.txt").is_none());
        assert!(read_character(&chars, "missing.png").is_none());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(root.join("private.txt"), chars.join("escape.png")).unwrap();
            assert!(read_character(&chars, "escape.png").is_none());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
