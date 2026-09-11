#!/usr/bin/env bash
# Install a pinned Gitleaks release using checksums reviewed and committed with this script.

set -euo pipefail

version="8.29.1"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
v2_root="$(cd "$script_dir/.." && pwd)"
install_dir="${GITLEAKS_INSTALL_DIR:-$v2_root/.tools}"
archive_dir="$(mktemp -d)"
trap 'rm -rf "$archive_dir"' EXIT

case "$(uname -s)" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *) echo "Unsupported operating system: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  arm64|aarch64) architecture="arm64" ;;
  x86_64|amd64) architecture="x64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

archive="gitleaks_${version}_${platform}_${architecture}.tar.gz"
release_base="https://github.com/gitleaks/gitleaks/releases/download/v${version}"

# From the official v8.29.1 release checksum manifest. Keeping the trust root in
# the repository prevents a compromised release host from replacing both the
# archive and a remotely downloaded checksum in the same request path.
case "$platform/$architecture" in
  darwin/arm64) expected="69836c841d7e648fb30ff4846f8c3587855c5754ed02b8510caaf6008f65d177" ;;
  darwin/x64) expected="2cd739c684bf3f543f4f37774075c276e40a72bb16c4c5bb9dfd27bf4a4465a7" ;;
  linux/arm64) expected="691f826ce7c1c564c9c02d0f9025e8e70803e3816707a4be6224408a06a81eaa" ;;
  linux/x64) expected="e4eb209d04e20339d77122a3bdf9cd41351255cfb27ebcb75e85325e04f88924" ;;
  *) echo "Missing pinned checksum for $platform/$architecture." >&2; exit 1 ;;
esac

curl --fail --silent --show-error --location "$release_base/$archive" \
  --output "$archive_dir/$archive"

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$archive_dir/$archive" | awk '{ print $1 }')"
else
  actual="$(shasum -a 256 "$archive_dir/$archive" | awk '{ print $1 }')"
fi
if [[ "$actual" != "$expected" ]]; then
  echo "Checksum verification failed for $archive." >&2
  exit 1
fi

mkdir -p "$install_dir"
tar -xzf "$archive_dir/$archive" -C "$archive_dir" gitleaks
install -m 0755 "$archive_dir/gitleaks" "$install_dir/gitleaks"
"$install_dir/gitleaks" version
