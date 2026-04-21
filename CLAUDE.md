# Rapid Cycle - プロジェクトガイド

## 概要
TOEIC等の英単語を**短時間で何周も回して短期記憶に叩き込む**高速周回型フラッシュカードアプリ。SRS（間隔反復）系とは異なり、1セッション内で同じ単語を繰り返し回すことに特化している。

- **技術スタック**: React (Vite) + localStorage + PWA
- **デプロイ**: Vercel（GitHub連携で自動デプロイ）
- **ターゲット**: iPhone PWA（ホーム画面追加で使用）
- **メインファイル**: `src/App.jsx`（約2900行、全機能が1ファイルに集約）

## プロジェクト構成
```
rapid-cycle/
├── index.html          # エントリHTML（PWAメタタグ、フォント読み込み）
├── public/
│   ├── manifest.json   # PWAマニフェスト
│   ├── sw.js           # Service Worker（オフライン対応）
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── main.jsx        # Reactエントリポイント
│   └── App.jsx         # アプリ本体（全ロジック・全UI）
└── package.json
```

## データ構造

### localStorage キー
- `rc_decks` — 単語帳の配列
- `rc_stats` — 単語ごとの学習記録
- `rc_settings` — ユーザー設定
- `rc_folders` — フォルダの配列

### 単語オブジェクト
```js
{ id, word, meaning, example_en, example_ja, note }
```
- `id`はユニーク（`genId()`で生成）。スペル修正しても記録が消えない
- statsのキーは`statsKey(w)` = `w.id || w.word`（後方互換）

### 単語帳
```js
{ id, name, words[], createdAt, folderId }
```

### フォルダ
```js
{ id, name }
```
1階層のみ。フォルダなし単語帳も許容。

### 学習記録（stats）
キー: 単語のid → 値:
```js
{ seen, correct, correctWithoutPeek, log[] }
```

### ログエントリ
```js
{ date, correct, peeked, round, sid }
```
- `peeked`: 答えを見てから判定したか
- `round`: セッション内のラウンド番号
- `sid`: セッションID（学習開始時に生成）
- 直近100件を保持

## 画面構成（view state）
`home` | `folder` | `detail` | `import` | `study` | `result` | `settings` | `crossSetup`

## 学習フロー

### カード操作
1. カード表示（例文 + 出題単語ハイライト）
2. **1回目のスワイプ**: その場で3D回転して裏面表示。右→右回転、左→左回転。記録されない
3. **2回目のスワイプ or タップ**: カードが指の軌道に沿って飛んでいき、判定が記録される
4. 1回目と逆方向にスワイプすれば判定を覆せる
5. タップで先に裏面を見てからスワイプも可能（peeked=true）

### 周回ロジック
- R1: 全単語シャッフル
- R2: R1不正解 + R1正解の一部（再登場率33%、設定可変）
- R3以降: 前ラウンド不正解 + 前ラウンド正解の一部（再登場率50%）
- 次ラウンド候補が**2語以下**で学習完了
- 記憶度に応じて再登場率を自動調整（定着×0.3、あと少し×0.7、要復習×1.3）

## 記憶度スコア算出（getMemoryScore）

### 加重平均方式
```
weight = ラウンド減衰 × 時間減衰
スコア = (正解weightの合計 / 全weightの合計) × 0.6 + (非peeked正解weightの合計 / 全weightの合計) × 0.4
```

### ラウンド減衰
`1 / round`（R1=1.0、R2=0.5、R3=0.33）

### 時間減衰
**その単語の**前回セッション終了 → 今回セッション開始の間隔で決定。同一セッション内の全エントリは同じ時間減衰を共有。

| 間隔 | 減衰 |
|---|---|
| 1時間未満 | ×0.6 |
| 3時間未満 | ×0.7 |
| 6時間未満 | ×0.8 |
| 12時間未満 | ×0.9 |
| 24時間未満 | ×0.95 |
| 24時間以上 | ×1.0 |
| 初回セッション | ×1.0 |

セッションの区別は`sid`（セッションID）で行う。

### 記憶度レベル
| スコア | レベル | ラベル | 色 |
|---|---|---|---|
| ≥0.85 | 3 | 定着 | 緑 #4ade80 |
| ≥0.55 | 2 | あと少し | 黄 #facc15 |
| <0.55 | 1 | 要復習 | 赤 #f87171 |
| 未学習 | 0 | 未学習 | グレー |

## カードアニメーション（animatingCards方式）

### アーキテクチャ
- `currentIdx`は即座に+1（待ち時間ゼロ）
- 飛んでいくカードは`animatingCards`配列で独立管理
- 2フェーズレンダリング（requestAnimationFrame x2）でアニメーション起動
- 飛んでいくカードのz-index=25、トップカード=20、背景カード=10以下
- 背景カードは不透明（opacity: 1）、色の違いで奥行きを表現
- 新トップカードは`cardPromote`アニメーション（0.4s）で滑らかに昇格
- 飛行速度: 1s（transform）、0.85s（opacity fade）

### タッチ操作
- `touchAction: "none"` + `overscrollBehavior: "none"` でiOSスクロール干渉対策
- swipeX, swipeYともにuseStateで管理（リアルタイムXY追従）
- スワイプ閾値: 60px

## テーマシステム
- `THEMES`オブジェクトに`dark`/`light`の色トークンを定義
- `makeStyles(t)`関数がテーマトークンを受け取ってスタイルを生成
- `useMemo`でテーマ変更時のみスタイルを再計算
- 設定画面から切り替え可能

## CSV形式
```
word,meaning,example_en,example_ja,note
```
- noteは省略可（4列/5列対応）
- タブ区切りにも対応
- インポート時に各単語に自動でユニークIDを付与

## 重要な設計判断
- カード作成はClaude等のAIに任せてCSVで取り込む方針（アプリ内AI機能は不要）
- iOSのWebViewでは`confirm()`が動作しないため、全てカスタムモーダルを使用
- iOSではBlobダウンロードが動作しないため、クリップボードコピー方式を使用
- 判定とrecordResultはdismissCard内で一元実行（非同期ステートの罠を回避）
- 単語リストのタップでプレビューモーダル表示（誤タップで即編集にならないように）
- 削除ボタンはホーム画面ではなく各詳細ページに小さく配置

## バックアップ
- 設定画面から手動エクスポート/インポート（クリップボード経由JSON）
- GAS連携による自動バックアップは未実装（PWA環境での動作確認が必要）

## 保留中の機能
- GAS連携自動バックアップ
- JA→EN方向の出題
- ネストフォルダ（現在1階層、必要になれば追加）

## 修正時の注意点
- useStateの宣言は必ずコンポーネントのトップレベルに配置（条件分岐の後に置くとフック順が狂う）
- iOSでの動作確認を必ず行う（スクロール干渉、confirm()、Blobダウンロード等）
- 記憶度関連の変更時はgetMemoryScore, getMemoryLevel, getMemoryLevelForWord, getMemoryReappearMultiplierの4箇所を確認
- stats参照は必ずstatsKey()を経由する（w.wordを直接キーにしない）
