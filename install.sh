#!/usr/bin/env bash
set -euo pipefail

REPO="${CCC_REPO:-AdamGardelov/code-command-center2}"
VERSION="${CCC_INSTALL_VERSION:-latest}"
RELAUNCH=0

for arg in "$@"; do
  case "$arg" in
    --relaunch) RELAUNCH=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    PLATFORM="linux"
    ;;
  Darwin)
    PLATFORM="mac"
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    echo "On Windows, download the .exe installer from:" >&2
    echo "  https://github.com/$REPO/releases/latest" >&2
    exit 1
    ;;
esac

echo "Detected: $PLATFORM ($ARCH)"

if [ "$VERSION" = "latest" ]; then
  API_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  API_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

echo "Fetching release metadata from $API_URL"
RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API_URL")

TAG=$(echo "$RELEASE_JSON" | grep -m1 '"tag_name"' | cut -d'"' -f4)
if [ -z "$TAG" ]; then
  echo "Could not determine release tag" >&2
  exit 1
fi
echo "Release tag: $TAG"

if [ "$PLATFORM" = "linux" ]; then
  ASSET_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": *"[^"]*\.deb"' | head -1 | cut -d'"' -f4)
  ASSET_EXT="deb"
else
  ASSET_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": *"[^"]*\.dmg"' | head -1 | cut -d'"' -f4)
  ASSET_EXT="dmg"
fi

if [ -z "$ASSET_URL" ]; then
  echo "No .$ASSET_EXT asset found in release $TAG" >&2
  exit 1
fi

if command -v code-command-center &>/dev/null; then
  CURRENT=$(code-command-center --version 2>/dev/null || echo "")
  TAG_STRIPPED="${TAG#v}"
  if [ "$CURRENT" = "$TAG_STRIPPED" ]; then
    echo "Already on version $TAG — nothing to do."
    if [ "$RELAUNCH" = "1" ]; then
      echo "Relaunching anyway (--relaunch)…"
      nohup code-command-center >/dev/null 2>&1 &
    fi
    exit 0
  fi
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/ccc2.$ASSET_EXT"
echo "Downloading $ASSET_URL"
curl -fsSL "$ASSET_URL" -o "$ARCHIVE"

if [ "$PLATFORM" = "linux" ]; then
  echo "Installing .deb (requires sudo)"
  if ! sudo dpkg -i "$ARCHIVE"; then
    echo "dpkg reported missing dependencies, running apt-get install -f"
    sudo apt-get install -f -y
  fi
  INSTALLED_CMD="code-command-center"
else
  echo "Mounting dmg"
  MOUNT_DIR=$(hdiutil attach -nobrowse -readonly "$ARCHIVE" | tail -1 | awk '{print $3}')
  APP_NAME=$(ls "$MOUNT_DIR" | grep '\.app$' | head -1)
  if [ -z "$APP_NAME" ]; then
    hdiutil detach "$MOUNT_DIR" >/dev/null
    echo "No .app found inside dmg" >&2
    exit 1
  fi
  echo "Copying $APP_NAME to /Applications"
  rm -rf "/Applications/$APP_NAME"
  cp -R "$MOUNT_DIR/$APP_NAME" /Applications/
  hdiutil detach "$MOUNT_DIR" >/dev/null
  INSTALLED_CMD="open -a \"/Applications/$APP_NAME\""
fi

echo "Installed $TAG"

if [ "$RELAUNCH" = "1" ]; then
  echo "Relaunching…"
  if [ "$PLATFORM" = "linux" ]; then
    nohup code-command-center >/dev/null 2>&1 &
  else
    eval "$INSTALLED_CMD"
  fi
fi
