#!/bin/bash

# デプロイスクリプト：バージョン更新→ビルド→GitHub push→GAS push

VERSION_FILE=".deploy_version"
APP_SRC="gas/app.html"

# ===== バージョン更新 =====
TODAY=$(date +%Y%m%d)

if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE")
else
  CURRENT_VERSION="00000000-000"
fi
echo "前回のバージョン: $CURRENT_VERSION"

IFS='-' read -r OLD_DATE NUM <<< "$CURRENT_VERSION"

if [ "$OLD_DATE" = "$TODAY" ]; then
  NUM=$((10#${NUM} + 1))
  echo "本日の継続デプロイ: 番号を${NUM}に更新"
else
  NUM=1
  echo "新しい日付: ${OLD_DATE} → ${TODAY}"
fi

NEW_VERSION="${TODAY}-$(printf '%03d' $NUM)"
echo "新しいバージョン: $NEW_VERSION"
echo "$NEW_VERSION" > "$VERSION_FILE"

# app.htmlのVERSION定数を更新
sed -i.bak "s/const VERSION = '.*'/const VERSION = '$NEW_VERSION'/" "$APP_SRC"
rm "${APP_SRC}.bak"
echo "更新: $APP_SRC (VERSION=$NEW_VERSION)"

# ===== index.htmlをビルド =====
echo "index.htmlをビルド中..."
python3 build.py
if [ $? -ne 0 ]; then
  echo "❌ ビルド失敗"
  exit 1
fi
echo "ビルド完了"

# ===== GitHubにpush =====
git add .
git commit -m "Bump version to $NEW_VERSION"
git push origin main

# ===== GASにpush =====
cd gas
clasp push --force
cd ..

echo "✅ デプロイ完了: $NEW_VERSION"
