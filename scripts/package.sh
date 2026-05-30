#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ZIP_NAME="class-attender.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 拷贝扩展文件
rsync -av --exclude "dist" --exclude "node_modules" --exclude ".git" --exclude ".DS_Store" \
  "$ROOT_DIR/" "$DIST_DIR/src" > /dev/null

cd "$DIST_DIR/src"

# 移除打包不需要的文件夹
rm -rf dist scripts package.json package-lock.json yarn.lock pnpm-lock.yaml README.md || true

cd "$DIST_DIR/src"
rm -f "$ZIP_NAME"
zip -r "$DIST_DIR/$ZIP_NAME" . >/dev/null

echo "打包完成：$DIST_DIR/$ZIP_NAME"
echo "已解压扩展目录：$DIST_DIR/src"

