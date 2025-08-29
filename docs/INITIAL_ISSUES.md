# 初期Issueドラフト

以下はGitHub Issuesに起票するためのドラフトです。各項目をコピーして新規Issueとして作成してください（推奨ラベルは例）。

---

## 1) npm run dev の追加とポート統一
- 種別/ラベル: `task`, `enhancement`, `priority:medium`, `status:needs-triage`
- タイトル: [Task] npm run dev を追加しポートを統一する
- 背景: 開発で `npm run dev` を期待して実行するケースが多いが未定義。`start`/`dev` のポートがバラバラで混乱を招く。
- 提案: `dev` スクリプトを追加し、`start` と同一ポート(例: 5555)に統一。`README`に記載。
- 受け入れ基準:
  - `npm run dev` が起動し、`http://localhost:5555` でアクセスできる
  - `README` に開発/本番起動の記載が整備されている
  - 重複/競合する起動方法の説明に一貫性がある

---

## 2) AssetsManager.clearAllAssets の削除不整合を修正
- 種別/ラベル: `bug`, `priority:high`, `status:needs-triage`
- タイトル: [Bug] clearAllAssets が cubeStack/object3d を配列から除去しない
- 概要: `clearAllAssets()` がシーンからは削除する一方で `this.assets` から `cubeStack` を除外していない。`object3d` も削除対象に入っていないため、再読み込みで重複生成しうる。
- 再現手順:
  1. editor で配置 → ゲームで読み込み
  2. 「エディターから再読み込み」を複数回
  3. アセット重複や配列不整合が発生
- 期待結果: すべての生成物（cone/tire/cubeStack/object3d/checker/startLine等）が整合性を保ってクリーンに削除される
- 実際の結果: `this.assets` に一部が残る / 重複生成
- 受け入れ基準:
  - 再読み込みを繰り返してもアセットの重複・リークが発生しない
  - `this.assets` とシーンと物理ボディ配列が常に一致する

---

## 3) エディターの export/import に cubeStacks/objects3d を追加
- 種別/ラベル: `enhancement`, `priority:high`, `status:needs-triage`
- タイトル: [Feature] editor export/import で cubeStacks と objects3d を扱う
- 背景: `applyToGame()` は `cubeStacks/objects3d` を保存するが `export()/import()` は未対応で往復で情報が欠落する。
- 提案: `export()`/`import()` のスキーマに `cubeStacks` と `objects3d` を追加し互換性確保。
- 受け入れ基準:
  - export で全アセット種別がJSONに含まれる
  - import でJSONから正しく画面へ復元される
  - 既存の `mapDrivingAssets` との互換動作（古い形式は安全に読み込む）

---

## 4) アセットパスの大小文字揺れ (Asset vs assets) を統一
- 種別/ラベル: `task`, `bug`, `priority:medium`, `status:needs-triage`
- タイトル: [Task] フォルダ/参照パスの大小文字を統一する
- 背景: OSにより大小文字が区別され、異なる環境で 404 になる恐れ。`Asset/FSWMap.jpg` と `assets/...` が混在。
- 提案: ディレクトリ/参照を `assets/` に統一。対応するHTML/JS内の参照を一括置換。
- 受け入れ基準:
  - すべての画像/GLBの読み込みが大小文字非依存な環境でも成功
  - READMEやドキュメントの記載も統一

---

## 5) 車両リセット操作の追加 (Rキー/ボタン)
- 種別/ラベル: `enhancement`, `priority:medium`, `status:needs-triage`
- タイトル: [Feature] 車両を初期位置へリセットする操作を追加
- 背景: READMEに「R: リセット」の記載があるが現実装なし。走行不能時の復帰が必要。
- 提案: `R`キーで `Vehicle.resetPosition()` を呼ぶ。UIボタンも任意で追加。デバッグメニューにも項目追加可。
- 受け入れ基準:
  - `R`キーで確実に初期位置へ戻る
  - デバッグUIからも実行可能（任意）

---

## 6) ログ制御の DEBUG フラグ導入
- 種別/ラベル: `task`, `performance`, `priority:low`, `status:needs-triage`
- タイトル: [Task] コンソールログを環境フラグで制御
- 背景: 既定でログが多く、パフォーマンス/視認性に影響。開発時のみ詳細ログを出したい。
- 提案: `window.DEBUG = true/false` もしくは設定モジュールで制御、`debug()` ラッパーを導入。
- 受け入れ基準:
  - DEBUG=off で冗長ログが出ない
  - 既存のログ呼び出しが安全にラップされる

---

## 7) README を現状に合わせて更新
- 種別/ラベル: `docs`, `priority:medium`, `status:needs-triage`
- タイトル: [Docs] README の起動手順/操作/構成を最新化
- 背景: 起動ポートや操作説明（Rキーなど）に齟齬がある。
- 提案: 実行方法（`npm start`/`npm run dev`/Python）、ポート、操作一覧、エディターのexport/import項目、ファイル構成を現状に合わせる。
- 受け入れ基準:
  - README記載の手順で実際に動作
  - 操作・構成図がコードと一致

---

## 8) 物理エンジンの微調整と最適化
- 種別/ラベル: `performance`, `enhancement`, `priority:low`, `status:needs-triage`
- タイトル: [Perf] allowSleep/SAPBroadphase/接触設定の再調整
- 背景: 小規模シーンでも計算コストと安定性の最適点を探る余地。
- 提案: `allowSleep = true`、`SAPBroadphase` の適用検討、地面/ホイールの `ContactMaterial` のパラメータ再調整、`world.step` のサブステップ見直し。
- 受け入れ基準:
  - 目視での安定性向上（跳ね/沈み/スリップの改善）
  - フレームレート維持/改善

---

## 9) three/GLTFLoader のCDN依存をESMローカル構成へ移行（任意）
- 種別/ラベル: `enhancement`, `task`, `priority:low`, `status:needs-triage`
- タイトル: [Task] three.js/GLTFLoader をESMで取り込みビルド整備
- 背景: CDN依存はオフラインやバージョン不整合のリスク。将来的にVite等への移行を見据える。
- 提案: 段階的に `import` ベースへ移行し、CDNを廃止。必要に応じてVite導入を別Issueで扱う。
- 受け入れ基準:
  - ローカルのみでビルド/起動が完結
  - バージョン整合が取れる

---

> 補足: `docs/ISSUE_LABELS.md` の推奨ラベルを先に作成すると運用がスムーズです。

