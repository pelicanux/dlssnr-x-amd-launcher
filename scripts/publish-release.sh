#!/usr/bin/env bash
set -euo pipefail
# Publish binary assets only. No source files or local credentials are uploaded.
repo=pelicanux/dlssnr-x-amd-launcher
root=$(cd "$(dirname "$0")/.." && pwd)
version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$root/src-tauri/tauri.conf.json")
tag="v$version"
python3 - "$root" "$version" <<'PYVERSIONS'
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1]); expected = sys.argv[2]
package = json.loads((root / "package.json").read_text())["version"]
cargo = re.search(r'^version\s*=\s*"([^"\n]+)"', (root / "src-tauri/Cargo.toml").read_text(), re.M).group(1)
if package != expected or cargo != expected:
    sys.exit("Versions differ. Update package.json, Cargo.toml and tauri.conf.json together.")
PYVERSIONS
notes=${1:?Usage: scripts/publish-release.sh /path/to/release-notes.md}
[[ -f "$notes" ]] || { echo 'Release notes file not found.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'Install GitHub CLI and run gh auth login.' >&2; exit 1; }
# Only select packages with the current version; never upload old builds.
mapfile -d '' packages < <(find "$root/src-tauri/target/release/bundle" -type f \( -name "*_${version}_*.AppImage" -o -name "*_${version}_*.deb" -o -name "*-${version}-*.rpm" \) -print0)
for format in AppImage deb rpm; do
  found=false
  for package in "${packages[@]}"; do [[ "$package" == *."$format" ]] && found=true; done
  [[ "$found" == true ]] || { echo "Missing $format for $version. Run bun run tauri build first." >&2; exit 1; }
done
# Refuse overwriting an existing version: every published update gets a new version.
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "Release $tag already exists. Increase the version before publishing." >&2; exit 1
fi
gh release create "$tag" "${packages[@]}" --repo "$repo" --title "DLSSNR X AMD $version" --notes-file "$notes" --draft
# The release becomes visible to the updater only after every package was uploaded.
gh release edit "$tag" --repo "$repo" --draft=false --latest
