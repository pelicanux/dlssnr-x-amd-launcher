#!/usr/bin/env bash
# Rebuild the generated RPM manifest so /usr/bin contains a wrapper, not a second ELF.
# Tauri's RPM bundler reserves its main /usr/bin entry and ignores a custom replacement.
set -euo pipefail
package=$(realpath "$1")
root=$(cd "$(dirname "$0")/.." && pwd)
# A layout rewrite changes the payload. Never silently discard an existing signature.
signature=$(rpm -qp --qf '%{RSAHEADER:pgpsig}\n%{DSAHEADER:pgpsig}\n%{SIGGPG:pgpsig}\n%{SIGPGP:pgpsig}' "$package")
signature=${signature//\(none\)/}
if [[ -n "${signature//[[:space:]]/}" ]]; then
  echo 'Finalize o layout /opt antes de assinar o RPM.' >&2
  exit 1
fi
work=$(mktemp -d /tmp/dlssnr-rpm-layout-XXXXXX)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/payload" "$work/SPECS" "$work/RPMS"
(cd "$work/payload"; rpm2cpio "$package" | cpio -idm --quiet --no-absolute-filenames)
test -x "$work/payload/opt/dlssnr-x-amd/dlssnr-x-amd"
install -m 755 "$root/src-tauri/packaging/dlssnr-x-amd" "$work/payload/usr/bin/dlssnr-x-amd"
name=$(rpm -qp --qf '%{NAME}' "$package")
version=$(rpm -qp --qf '%{VERSION}' "$package")
release=$(rpm -qp --qf '%{RELEASE}' "$package")
arch=$(rpm -qp --qf '%{ARCH}' "$package")
epoch=$(rpm -qp --qf '%{EPOCHNUM}' "$package")
license=$(rpm -qp --qf '%{LICENSE}' "$package")
summary=$(rpm -qp --qf '%{SUMMARY}' "$package")
for value in "$name" "$version" "$release" "$arch" "$epoch"; do
  [[ "$value" =~ ^[a-zA-Z0-9._+-]+$ ]] || { echo 'Invalid RPM metadata' >&2; exit 1; }
done
spec="$work/SPECS/launcher.spec"
cat > "$spec" <<SPEC
Name: $name
Version: $version
Release: $release
Epoch: $epoch
BuildArch: $arch
License: $license
Summary: $summary
AutoReqProv: no
Requires: /bin/sh
SPEC
while IFS= read -r dependency; do
  case "$dependency" in rpmlib\(*|'') continue ;; esac
  printf 'Requires: %s\n' "$dependency" >> "$spec"
done < <(rpm -qp --requires "$package")
cat >> "$spec" <<SPEC
%description
$summary

%install
mkdir -p "%{buildroot}"
cp -a "$work/payload/." "%{buildroot}/"

%files
%defattr(-,root,root,-)
%dir /opt/dlssnr-x-amd
SPEC
while IFS= read -r -d '' file; do
  relative=${file#"$work/payload"}
  printf '"%s"\n' "$relative" >> "$spec"
done < <(find "$work/payload" -type f -print0)
rpmbuild -bb --quiet --buildroot "$work/buildroot" \
  --define "_topdir $work" --define "_tmppath $work" --define '_build_id_links none' \
  --define '__os_install_post %{nil}' --define '_binary_payload w6.gzdio' \
  --define '_rpmformat 4' "$spec"
staged=$(mktemp "$(dirname "$package")/.opt-rpm-XXXXXX")
cp "$work/RPMS/$arch/$name-$version-$release.$arch.rpm" "$staged"
mv -f "$staged" "$package"
echo "RPM: executável em /opt e atalho em /usr/bin"
