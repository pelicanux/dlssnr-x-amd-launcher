#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

# Record this build's start so an AppImage-only build does not copy older DEB/RPM files.
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
bun "$root/node_modules/@tauri-apps/cli/tauri.js" "$@"

case "${1:-}" in
  build|bundle) ;;
  *) exit 0 ;;
esac

profile=release
build_target=
previous=
for argument in "$@"; do
  if [[ "$previous" == --target ]]; then build_target=$argument; fi
  case "$argument" in
    --debug) profile=debug ;;
    --target=*) build_target=${argument#--target=} ;;
  esac
  previous=$argument
done

# Cargo resolves custom target directories configured through the environment or .cargo.
target_root=$(cargo metadata --offline --no-deps --format-version 1 --manifest-path "$root/src-tauri/Cargo.toml" | bun -e 'let input = ""; for await (const chunk of process.stdin) input += chunk; console.log(JSON.parse(input).target_directory)')
output="$target_root/${build_target:+$build_target/}$profile"
mkdir -p "$root/release"

# Replace files atomically, including an executable that is currently running.
copy_to_release() {
  local source=$1 temporary
  temporary=$(mktemp "$root/release/.copy-XXXXXX")
  if ! cp -p "$source" "$temporary"; then rm -f "$temporary"; return 1; fi
  if ! mv -f "$temporary" "$root/release/$(basename "$source")"; then rm -f "$temporary"; return 1; fi
  echo "Copiado para release/: $(basename "$source")"
}

if [[ -d "$output/bundle" ]]; then
  while IFS= read -r -d '' package; do
    copy_to_release "$package"
  done < <(find "$output/bundle" -maxdepth 2 -type f -newer "$marker" \( -name '*.AppImage' -o -name '*.AppImage.sig' -o -name '*.deb' -o -name '*.rpm' \) -print0)
fi
if [[ -f "$output/dlssnr-x-amd" && "$output/dlssnr-x-amd" -nt "$marker" ]]; then
  copy_to_release "$output/dlssnr-x-amd"
fi
