#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

# Record this build's start so an AppImage-only build does not copy older DEB/RPM files.
marker=$(mktemp)
layout_config=
trap 'rm -f "$marker"; if [[ -n "$layout_config" ]]; then rm -f "$layout_config"; fi' EXIT

case "${1:-}" in
  build|bundle) ;;
  *) bun "$root/node_modules/@tauri-apps/cli/tauri.js" "$@"; exit 0 ;;
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
# Resolve the compiled executable for release/debug and custom Cargo target directories.
# Tauri patches its bundle type before reading these files for each DEB/RPM bundle.
if [[ "$(uname -s)" == Linux && ( -z "$build_target" || "$build_target" == *linux* ) ]]; then
  layout_config=$(mktemp /tmp/dlssnr-package-layout-XXXXXX.json)
  bun -e 'const binary = process.argv[1]; const files = {"/opt/dlssnr-x-amd/dlssnr-x-amd": binary}; console.log(JSON.stringify({bundle:{linux:{deb:{files},rpm:{files}}}}))' "$output/dlssnr-x-amd" > "$layout_config"
  bun "$root/node_modules/@tauri-apps/cli/tauri.js" "$@" --config "$layout_config"
else
  bun "$root/node_modules/@tauri-apps/cli/tauri.js" "$@"
fi
# Rewrite RPM's reserved main binary entry while keeping package ownership and dependencies.
if [[ -d "$output/bundle/rpm" ]]; then
  while IFS= read -r -d '' package; do
    if command -v rpmbuild >/dev/null && command -v rpm2cpio >/dev/null && command -v cpio >/dev/null; then
      bash "$root/scripts/rpm-opt-layout.sh" "$package"
    elif command -v distrobox-host-exec >/dev/null; then
      distrobox-host-exec bash "$root/scripts/rpm-opt-layout.sh" "$package"
    else
      echo 'Para gerar RPM em /opt, instale rpm, rpmbuild e cpio.' >&2
      exit 1
    fi
  done < <(find "$output/bundle/rpm" -maxdepth 1 -type f -newer "$marker" -name '*.rpm' -print0)
fi
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
