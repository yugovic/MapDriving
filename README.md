# MapDriving - 富士スピードウェイ3Dドライビングゲーム

富士スピードウェイのマップ上で3D車両を運転できるWebベースのドライビングゲームです。アセットエディター機能付きで、コースレイアウトをカスタマイズできます。

## 🎮 デモ

[GitHub Pagesでプレイ](https://[your-username].github.io/MapDriving/)

## ✨ 特徴

- **3Dドライビング体験**: Three.jsとCannon.jsを使用したリアルな物理シミュレーション
- **富士スピードウェイマップ**: 実際のサーキットレイアウトを再現
- **アセットエディター**: コーンやタイヤバリアを自由に配置
- **カスタマイズ可能**: マップサイズの調整、アセット配置の保存/読み込み
- **サウンド**: エンジン音/ブレーキ/衝突（ローカル音源 or フォールバック合成音）

## 🚀 始め方

### オンラインでプレイ

1. [ゲームページ](https://[your-username].github.io/MapDriving/)にアクセス
2. 矢印キーまたはWASDキーで車を操作

### ローカルで実行

```bash
# リポジトリをクローン
git clone https://github.com/[your-username]/MapDriving.git
cd MapDriving

# 推奨: npm のローカルサーバー
npm install
npm run dev   # http://localhost:5555 （キャッシュ無効）
# or
npm start     # http://localhost:5555

# 代替: Python の簡易サーバー
python3 -m http.server 8000  # http://localhost:8000
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
├── index.html                  # メインゲーム
├── editor.html                 # アセットエディター
├── js/
│   ├── main.js                 # ゲームのエントリーポイント
│   ├── config.js               # 設定ファイル
│   ├── scene.js                # 3Dシーン管理
│   ├── physics.js              # 物理エンジン
│   ├── vehicle.js              # 車両制御
│   ├── map.js                  # マップ表示
│   ├── input.js                # 入力処理
│   ├── assets.js               # アセット管理
│   ├── editor-enhanced.js      # 高機能エディター
│   └── editor.js               # 旧エディター
├── assets/
│   ├── FSWMap.jpg              # サーキットマップ画像
│   ├── audio/                  # サウンド（任意設置／大文字 Audio も可）
│   │   ├── engine-loop.mp3     # ループ用エンジン音（任意）
│   │   ├── brake.wav           # ブレーキ音（任意）
│   │   ├── collision.wav       # 衝突音（任意）
│   │   └── tire-screech.wav    # タイヤスキール（任意）
│   ├── Cars/
│   │   └── RX7_Savanna.glb
│   └── Object/
│       ├── BigRoadSign.glb
│       ├── NewsPaperStand.glb
│       ├── RoadBlock.glb
│       ├── ToyDuck.glb
│       ├── TramStop.glb
│       └── Tree.glb
└── README.md

備考: 互換のためマップ画像は `assets/FSWMap.jpg` または `Asset/FSWMap.jpg` のどちらでも動作するようローダーでフォールバック処理を実装しています。

## 🔊 サウンドについて
- 音源ファイルがある場合は `assets/audio/` 配下に上記ファイル名で配置してください。存在しない場合は、WebAudioの簡易合成音（オシレータ/ノイズ）でフォールバック再生します。
- ブラウザのオートプレイ制限により、初回のキー入力/クリックまで音が鳴らない場合があります。

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
