# GitHub Pages セットアップガイド

## 1. GitHubにリポジトリを作成

1. GitHubにログインして新しいリポジトリを作成
2. リポジトリ名を「MapDriving」に設定
3. PublicまたはPrivateを選択（Privateの場合は別途GitHub Pages設定が必要）
4. READMEの自動作成はチェックしない（既に作成済みのため）

## 2. ローカルリポジトリの初期化とプッシュ

```bash
cd /Users/Yugox/Documents/Program/MapDriving

# Gitリポジトリを初期化
git init

# すべてのファイルを追加
git add .

# 初回コミット
git commit -m "Initial commit: MapDriving game with asset editor"

# GitHubリポジトリをリモートとして追加
git remote add origin https://github.com/[your-username]/MapDriving.git

# mainブランチにプッシュ
git branch -M main
git push -u origin main
```

## 3. GitHub Pages の有効化

1. GitHubリポジトリページで「Settings」をクリック
2. 左側メニューの「Pages」をクリック
3. 「Source」セクションで：
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
4. 「Save」をクリック

## 4. デプロイの確認

- 数分待つと、以下のURLでアクセス可能になります：
  - `https://[your-username].github.io/MapDriving/`

## 5. README.mdの更新

デプロイ後、README.md内の以下の部分を実際のユーザー名に置き換えてください：

```markdown
[GitHub Pagesでプレイ](https://[your-username].github.io/MapDriving/)
```

## トラブルシューティング

### localStorageが動作しない場合

GitHub Pagesではhttps://プロトコルで提供されるため、localStorage は正常に動作するはずです。もし問題がある場合は、ブラウザの開発者ツールでコンソールを確認してください。

### 404エラーが出る場合

- リポジトリ名が正しいか確認
- GitHub Pagesが有効になっているか確認
- デプロイが完了するまで5-10分待つ

### アセットが読み込まれない場合

- `assets/fuji-speedway-map.jpg`が正しくコミットされているか確認
- パスの大文字小文字が正しいか確認（GitHubは大文字小文字を区別します）

## 更新方法

新しい変更をGitHub Pagesに反映する場合：

```bash
git add .
git commit -m "説明的なコミットメッセージ"
git push origin main
```

変更は自動的にGitHub Pagesに反映されます（数分かかる場合があります）。