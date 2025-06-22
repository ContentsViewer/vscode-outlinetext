# VS Code拡張機能開発セットアップ (WSL + Windows)

## 開発環境

- **WSL2**: コード編集、npm実行
- **Windows VSCode**: 拡張機能テスト、デバッグ

## 開発ワークフロー

### 1. WSL側での作業

```bash
# プロジェクトディレクトリに移動
cd /mnt/c/Users/onete/OneDrive/Documents/Web/repos/vscode-outlinetext

# 監視モードでTypeScriptコンパイル（常時実行）
npm run watch

# 新しいターミナルでコード編集
# nano, vim, VSCode Server, などお好みで
```

### 2. Windows VSCode側での作業

1. **フォルダを開く**
   ```
   File → Open Folder → 
   C:\Users\onete\OneDrive\Documents\Web\repos\vscode-outlinetext
   ```

2. **デバッグ実行**
   - `F5`キーを押す
   - または `Run and Debug`パネルから`Launch Extension`実行

3. **Extension Development Host**が起動
   - 新しいVSCodeウィンドウが開く
   - そこで`.content`ファイルをテスト

### 3. ファイル変更の同期

- WSLで編集 → 自動的にWindowsファイルシステムに反映
- `npm run watch`でTypeScript自動コンパイル
- Windows VSCodeで`Ctrl+Shift+F5`（リロード）

## 注意点

### パスの違い
- **WSL**: `/mnt/c/Users/onete/OneDrive/Documents/Web/repos/vscode-outlinetext`
- **Windows**: `C:\Users\onete\OneDrive\Documents\Web\repos\vscode-outlinetext`

### パフォーマンス
- ファイル監視はWSL→Windows間で少し遅延する場合あり
- 大きな変更後は手動でリロード推奨

### 権限
- WSL内でのnpm操作は問題なし
- ファイル作成・編集も正常動作

## 開発開始コマンド

```bash
# WSL Terminal 1: 監視モード
cd /mnt/c/Users/onete/OneDrive/Documents/Web/repos/vscode-outlinetext
npm run watch

# WSL Terminal 2: 開発作業
cd /mnt/c/Users/onete/OneDrive/Documents/Web/repos/vscode-outlinetext
# ここでファイル編集

# Windows VSCode: F5でデバッグ実行
```

## トラブルシューティング

### TypeScriptコンパイルエラー
```bash
npm run compile
```

### 拡張機能が認識されない
- Windows VSCodeで拡張機能フォルダを再度開く
- `Ctrl+Shift+P` → `Developer: Reload Window`

### ファイル変更が反映されない
- WSLでファイル保存確認
- Windows VSCodeでリロード（`Ctrl+Shift+F5`）