#!/bin/bash

# MapDrivingプロジェクト用ローカルサーバー起動スクリプト

echo "MapDrivingプロジェクト用ローカルサーバーを起動します..."
echo ""
echo "以下のURLでアクセスできます："
echo "  - ゲーム: http://localhost:8888/index.html"
echo "  - エディター: http://localhost:8888/editor.html"
echo "  - デバッグツール: http://localhost:8888/debug-localstorage.html"
echo "  - テストツール: http://localhost:8888/test-localstorage.html"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""

# Python 3でサーバーを起動（ポート8888）
python3 -m http.server 8888