# MapDriving - 富士スピードウェイ3Dドライビングゲーム

富士スピードウェイのマップ上で3D車両を運転できるWebベースのドライビングゲームです。アセットエディター機能付きで、コースレイアウトをカスタマイズできます。

## 🎮 デモ

[GitHub Pagesでプレイ](https://[your-username].github.io/MapDriving/)

## ✨ 特徴

- **3Dドライビング体験**: Three.jsとCannon.jsを使用したリアルな物理シミュレーション
- **富士スピードウェイマップ**: 実際のサーキットレイアウトを再現
- **アセットエディター**: コーンやタイヤバリアを自由に配置
- **カスタマイズ可能**: マップサイズの調整、アセット配置の保存/読み込み

## 🚀 始め方

### オンラインでプレイ

1. [ゲームページ](https://[your-username].github.io/MapDriving/)にアクセス
2. 矢印キーまたはWASDキーで車を操作

### ローカルで実行

```bash
# リポジトリをクローン
git clone https://github.com/[your-username]/MapDriving.git
cd MapDriving

# ローカルサーバーを起動（Python 3）
python3 -m http.server 8000

# ブラウザでアクセス
# http://localhost:8000
```

## 🎯 操作方法

### ゲーム操作
- **↑ / W**: 前進
- **↓ / S**: 後退
- **← / A**: 左折
- **→ / D**: 右折
- **Space**: ブレーキ
- **R**: リセット（車両を初期位置に戻す）
- **Ctrl + M**: デバッグメニューの表示/非表示

### エディター操作
- **左クリック**: アセットを配置
- **右クリック**: アセットを選択
- **ドラッグ**: アセットを移動
- **Deleteキー**: 選択したアセットを削除
- **Ctrl + Z**: 元に戻す
- **Ctrl + Shift + Z**: やり直し

## 📁 プロジェクト構造

```
MapDriving/
├── index.html          # メインゲーム
├── editor.html         # アセットエディター
├── js/
│   ├── main.js         # ゲームのエントリーポイント
│   ├── config.js       # 設定ファイル
│   ├── scene.js        # 3Dシーン管理
│   ├── physics.js      # 物理エンジン
│   ├── vehicle.js      # 車両制御
│   ├── map.js          # マップ表示
│   ├── input.js        # 入力処理
│   ├── assets.js       # アセット管理
│   └── editor-enhanced.js  # エディター機能
├── assets/
│   └── fuji-speedway-map.jpg  # サーキットマップ画像
└── README.md

```

## 🛠️ 技術スタック

- **Three.js**: 3Dグラフィックス
- **Cannon.js**: 物理エンジン
- **Vanilla JavaScript**: ES6モジュール
- **HTML5 Canvas**: エディターUI

## 🤝 貢献

プルリクエストを歓迎します！大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- Three.js コミュニティ
- Cannon.js 開発者
- 富士スピードウェイ

---

楽しいドライビングを！ 🏁