"""Ensure the application graph and release regression tests use the same patch."""

from pathlib import Path
import tomllib

root = Path(__file__).resolve().parents[1] / "src-tauri"


def read_toml(path):
    return tomllib.loads(path.read_text())


patched = (root / "vendor/glib").resolve()
app_patch = read_toml(root / "Cargo.toml")["patch"]["crates-io"]["glib"]
test_dependency = read_toml(root / "security-tests/Cargo.toml")["dependencies"]["glib"]
if (root / app_patch["path"]).resolve() != patched:
    raise SystemExit("Application must resolve glib through the reviewed local patch")
if (root / "security-tests" / test_dependency["path"]).resolve() != patched:
    raise SystemExit("Regression tests must exercise the same patched glib as the application")

locked = [p for p in read_toml(root / "Cargo.lock")["package"] if p["name"] == "glib"]
if len(locked) != 1 or "source" in locked[0]:
    raise SystemExit("Cargo.lock must not contain a second or registry-sourced glib")
if locked[0]["version"] != read_toml(patched / "Cargo.toml")["package"]["version"]:
    raise SystemExit("Locked glib version must match the reviewed local source")

print("Application lock and regression tests both resolve the reviewed local glib patch")
