#!/bin/bash

# デプロイスクリプト：バージョンを自動インクリメントしてpush（GAS + GitHub）

APP_HTML="gas/app.html"
VERSION_FILE=".deploy_version"

# 今日の日付を取得（YYYYMMDD形式）
TODAY=$(date +%Y%m%d)

# バージョン記録ファイルから前回のバージョンを取得
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE")
else
  CURRENT_VERSION="00000000-000"
fi
echo "前回のバージョン: $CURRENT_VERSION"

# 前回のバージョンから日付と番号を抽出
IFS='-' read -r OLD_DATE NUM <<< "$CURRENT_VERSION"

# 日付が変わってたら001にリセット、同じ日なら番号をインクリメント
if [ "$OLD_DATE" = "$TODAY" ]; then
  NUM=$((10#${NUM} + 1))
  echo "本日の継続デプロイ: 番号を${NUM}に更新"
else
  NUM=1
  echo "新しい日付: ${OLD_DATE} → ${TODAY}"
fi

NEW_VERSION="${TODAY}-$(printf '%03d' $NUM)"
echo "新しいバージョン: $NEW_VERSION"

# バージョンを記録ファイルに保存
echo "$NEW_VERSION" > "$VERSION_FILE"

# app.htmlのVERSION定数を更新
if [ -f "$APP_HTML" ]; then
  sed -i.bak "s/const VERSION = '.*'/const VERSION = '$NEW_VERSION'/" "$APP_HTML"
  rm "${APP_HTML}.bak"
  echo "更新: $APP_HTML"
else
  echo "⚠️ ファイルが見つかりません: $APP_HTML"
fi

# GitHubにpush
git add .
git commit -m "Bump version to $NEW_VERSION"
git push origin main

# GASにpush
cd gas
clasp push --force
cd ..

echo "✅ デプロイ完了: $NEW_VERSION"
