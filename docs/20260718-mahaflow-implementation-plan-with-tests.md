# 実装計画書（テスト設計付き）— MahaFlow

- ドキュメント種別: 実装計画書 (Implementation Plan with Test Design)
- 版: 1.0（0.1版計画書および全確定事項を統合。本書が正）
- 最終更新: 2026-07-18
- 対応文書: `20260718-mahaflow-detailed-design-spec.md`（以下「仕様書」）

---

## 1. 成果物

| # | 成果物 | 形態 |
|---|---|---|
| 1 | npmパッケージ | ESMコア + Web Component + Reactラッパ + 型定義 |
| 2 | スタンドアロン単体HTML | 内蔵UI＋自動再生付き鑑賞ビルド |
| 3 | サンプル | 素DOM / React / データ注入(A・B) / 書き出し |
| 4 | テストスイート | 本書§6の全テスト（CIで自動実行） |
| 5 | ドキュメント | README・API・埋め込みガイド・書き出しガイド |
| 6 | 方式Cジョブ契約 | JSONスキーマ＋契約テスト（実装は後続） |

## 2. 技術選定

| 項目 | 採用 | 根拠 |
|---|---|---|
| 言語 | TypeScript (strict) | API契約を型で固定 |
| 描画 | three.js | モックアップ資産継承。距離計算はGLSL集約 |
| ビルド | Vite (lib mode) + 単体HTMLはインライン化ビルド | npm/スタンドアロン二系統を単一ソースから |
| 単体テスト | Vitest | 数理・契約テスト |
| ブラウザテスト | Playwright | 視覚回帰・統合・エクスポート検証 |
| 動画検証 | ffprobe (CIコンテナ内) | CFR・タイムベース・メタデータ検証 |
| Lint/静的検査 | ESLint + カスタムルール | window/Math.random/Date.now 禁止の機械検査 |

## 3. フェーズ計画（WBS）

依存関係: P0 → P1 → P2 → {P3, P4, P5}（P3/P4/P5は並行可）

### P0 — 基盤: コア分離・決定論（後工程すべての前提）

| タスク | 内容 | 完了条件(DoD) |
|---|---|---|
| P0-1 | リポジトリ雛形・CI（lint/型/テスト/静的検査） | 禁止API検査がCIで落とせる |
| P0-2 | seed PRNG＋サブストリーム＋Box–Muller (`math/prng.ts`) | T-M01〜03 pass |
| P0-3 | モックアップの数理移植 (`cluster/tour/project`) | T-M04〜08 pass |
| P0-4 | 決定論クロック (`core/clock.ts`、タイムベース有理数) | T-M09〜10 pass |
| P0-5 | `MahaFlowCore` 骨格: コンテナ描画・ResizeObserver・dispose | T-I01, T-I05 pass |
| P0-6 | 場ビュー(なめらか)の描画到達 | 目視＋T-V01 pass |

### P1 — config / state / API / イベント

| タスク | 内容 | DoD |
|---|---|---|
| P1-1 | InitConfig/LiveParams スキーマ・検証・既定値 | T-A01〜03 pass |
| P1-2 | `setConfig`/`getState`/`randomize(seed?)`（frame含む再現） | T-A04〜06 pass |
| P1-3 | イベント基盤 (`on`/CustomEvent) と `ready`/`statechange`/`hover`/`warning` | T-A07〜08 pass |
| P1-4 | エラー処理方針の実装（仕様書§15の表） | T-A09〜11 pass |

### P2 — 表現網羅・入力・プリセット・自動再生

| タスク | 内容 | DoD |
|---|---|---|
| P2-1 | 4表現×2視点×2地形の全経路（粒子系・俯瞰系の移植） | T-V02〜05 pass |
| P2-2 | 入力: ズーム/パン/中心軸/回転/リセット（要素スコープ） | T-I02〜04 pass |
| P2-3 | パレット機構（uniform切替・追加API） | T-V06, T-C01〜02 pass |
| P2-4 | 変調バス (`core/modulation.ts`) | T-D01〜02 pass |
| P2-5 | プリセット (`presets.ts`: 既定4種・save/apply/list) | T-A12 pass |
| P2-6 | 自動再生 (`autoplay.ts`: 巡回・crossfade・フレーム基準) | T-A13〜14 pass |
| P2-7 | reduced-motion・自動品質調整 | T-P03, T-I06 pass |

### P3 — シェル・埋め込み・配布

| タスク | 内容 | DoD |
|---|---|---|
| P3-1 | Web Component `<maha-flow>`（属性束縛・CustomEvent） | T-S01〜02 pass |
| P3-2 | React ラッパ | T-S03 pass |
| P3-3 | 複数インスタンス・dispose解放検証 | T-I05, T-I07 pass |
| P3-4 | devパネル（遅延ロード・ui:"none"で非生成） | T-S04 pass |
| P3-5 | スタンドアロン単体HTMLビルド | T-S05 pass |
| P3-6 | サンプル(dom/react) | 手動確認＋README |

### P4 — データ注入・距離抽象・色覚検証

| タスク | 内容 | DoD |
|---|---|---|
| P4-1 | `Metric` 抽象化とマハラノビス実装の適合（GLSLチャンク差込） | T-M11 pass |
| P4-2 | 形態A注入（検証・正定値射影・strict） | T-M12〜13 pass |
| P4-3 | 形態B推定 (`estimate.ts`: 標本/縮小推定) | T-M14〜15 pass |
| P4-4 | 色覚検証（輝度単調・P/D型シミュレーション）をテスト化 | T-C01〜03 pass |
| P4-5 | 性能チューニング・予算計測 | T-P01〜02 pass |

### P5 — 動画エクスポート

| タスク | 内容 | DoD |
|---|---|---|
| P5-1 | 方式A: captureStream + MediaRecorder（プレビュー限定明記） | T-E01 pass |
| P5-2 | 方式B: オフスクリーン逐次描画 + WebCodecs、CFRタイムスタンプ | T-E02〜05 pass |
| P5-3 | フォールバック(WebM)・進捗・キャンセル・NaN保護 | T-E06〜08 pass |
| P5-4 | 変調バス×エクスポートの一致検証 | T-E09 pass |
| P5-5 | 方式Cジョブ契約（JSONスキーマ＋契約テスト） | T-E10 pass |
| P5-6 | 書き出しガイド（fps/タイムベース/編集ソフト連携の注意） | ドキュメントレビュー |

## 4. ディレクトリ構成

```
maha-flow/
├─ src/
│  ├─ core/        MahaFlowCore.ts / config.ts / state.ts /
│  │               clock.ts / modulation.ts / presets.ts / autoplay.ts
│  ├─ math/        prng.ts / cluster.ts / estimate.ts / tour.ts /
│  │               project.ts / metric.ts
│  ├─ render/      shaders/(common|field|surface|floor|points).glsl.ts /
│  │               fieldView.ts / orbitView.ts / particles.ts / quality.ts
│  ├─ export/      realtime.ts / offline.ts / encoder.ts / serverContract.ts
│  ├─ interact/    controls.ts
│  ├─ palette/     palettes.ts / luminance.ts(検証用)
│  ├─ ui/          devPanel.ts
│  ├─ element/     maha-flow.ts
│  └─ react/       MahaFlow.tsx
├─ standalone/     index.html(ビルド出力)
├─ examples/       dom / react / data-inject / export
├─ test/           unit / contract / visual / perf / export
└─ package.json
```

## 5. テスト戦略（全体方針）

- **決定論を武器にする**: seedとフレーム番号を固定すればあらゆる出力が再現可能。視覚回帰・エクスポート検証はこれを前提に厳密比較する。
- レイヤ対応: 数理=Vitest(node)、契約=Vitest(jsdom+WebGLモック)、視覚/統合/エクスポート=Playwright(実ブラウザ)、動画メタ=ffprobe。
- CIゲート: 全テストpassをマージ条件。視覚回帰の基準画像はseed・frame固定でリポジトリ管理。

## 6. テストケース一覧

### 6.1 数理単体（T-M）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-M01 | PRNG再現 | 同一seedで2ストリーム生成し1000個比較 | 完全一致 |
| T-M02 | サブストリーム独立 | 片方をN個消費後、他方の系列を比較 | 消費前と一致 |
| T-M03 | 正規乱数分布 | 1e5サンプルの平均/分散/歪度 | 0/1/0 に許容誤差内 |
| T-M04 | Σ正定値 | 生成1000クラスタの最小固有値 | > 0 |
| T-M05 | 中心化 | 生成後の可視クラスタ平均の重心ノルム | < 1e-9 |
| T-M06 | ツアー直交性 | 任意tで ‖u‖,‖v‖,‖w‖=1, 内積=0 | 誤差 < 1e-9 |
| T-M07 | 射影距離の正当性 | 既知2次元Σ・恒等射影で d² を手計算と照合 | 一致 |
| T-M08 | soft-min収束 | 単一クラスタ・τ→0.1 で D と解析マハラノビス距離 | 相対誤差 < 1% |
| T-M09 | クロック有理数 | fps=30000/1001, n=1001 の t | 厳密に 1001·1001/30000 …整数演算で誤差0 |
| T-M10 | frame再開 | state保存→復元→同フレーム描画入力(基底・射影) | 完全一致 |
| T-M11 | Metric契約 | jsEval と GLSL同式(参照実装)で格子点比較 | 相対誤差 < 1e-5 |
| T-M12 | 形態A検証 | 非対称/非正定値Σを注入 | 対称化・固有値クリップ＋warning(strictで例外) |
| T-M13 | 形態A同一経路 | 生成クラスタをgetState→形態A再注入 | 射影結果一致 |
| T-M14 | 形態B収束 | 既知分布からNサンプル推定、N=10dims | μ,Σ誤差が理論レート内 |
| T-M15 | 縮小推定 | N=dims+1 の少数標本 | Σ推定が正定値 |

### 6.2 API契約（T-A）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-A01 | seed必須 | seed無しで構築 | 同期例外 |
| T-A02 | 既定値 | 最小configで getState | 仕様書§5の既定値と一致 |
| T-A03 | 範囲クランプ | zoom=99 等を setConfig | クランプ＋warning |
| T-A04 | live反映 | 各liveキーをsetConfig→次フレームuniforms | 反映 |
| T-A05 | init-only保護 | dims をsetConfig | 無視＋warning |
| T-A06 | state往復 | getState→新インスタンスへ復元→開始フレーム | ピクセル一致(視覚T-V07と連動) |
| T-A07 | statechange | setConfigで1回、フレーム進行のみでは0回 | 発火回数一致 |
| T-A08 | hover | 場ビューでポインタ移動 | D値がJS参照計算と一致 |
| T-A09 | dispose後API | dispose→各API呼出 | no-op＋warning、例外なし |
| T-A10 | 次元不一致 | dims=8にmu長6を注入 | 同期例外 |
| T-A11 | NaN保護 | 極端値でNaN誘発 | フレームスキップ＋イベント、以後回復 |
| T-A12 | プリセット往復 | savePreset→変更→applyPreset | stateがsave時と一致 |
| T-A13 | 自動再生決定論 | seed固定でautoplay "randomize" を2回実行 | 遷移seed列が一致 |
| T-A14 | 自動再生制御 | config起動→stopAutoplay→startAutoplay | 状態遷移とstatechange発火 |

### 6.3 視覚回帰（T-V）Playwright・seed/frame固定

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-V01 | 基準: 場×なめらか | seed=42, frame=0 スクリーンショット | 基準画像と一致(閾値付き) |
| T-V02 | 全モード×場 | wave/capillary/particle 各frame固定 | 各基準画像と一致 |
| T-V03 | 俯瞰×地形2 | mountains/bowl × smooth | 一致 |
| T-V04 | 俯瞰×モード起伏 | wave/capillary の地形化 | 一致 |
| T-V05 | 粒子×俯瞰 | 曲面/床が非表示で点群のみ | 一致 |
| T-V06 | パレット | 3既定＋追加1で同frame | 一致 |
| T-V07 | state復元 | T-A06のスクリーンショット比較 | 一致 |
| T-V08 | ズーム/パン | zoom=3, pan指定でframe固定 | 一致 |

### 6.4 埋め込み・統合（T-I / T-S）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-I01 | コンテナ描画 | 400×300 divへmount | canvasがdiv内、サイズ追従(ResizeObserver) |
| T-I02 | 入力スコープ | コンテナ外でwheel/drag | インスタンスに影響なし |
| T-I03 | ズーム中心 | カーソル位置ズーム | カーソル下のD値が不変 |
| T-I04 | 俯瞰パン | Shiftドラッグ | 注視点移動、回転と非干渉 |
| T-I05 | dispose解放 | mount→dispose を20回 | コンテキストロスト/リークなし(WEBGL_lose_context確認) |
| T-I06 | reduced-motion | エミュレーション有効化 | 位相進行0.1倍・autoplay切替停止 |
| T-I07 | 3インスタンス | 同一ページで別seed | 相互独立(state/入力/描画) |
| T-S01 | WC属性 | 属性変更→live反映 | 反映＋maha-イベント発火 |
| T-S02 | WCイベント | statechange購読 | CustomEventで受信 |
| T-S03 | React往復 | mount→props変更→unmount | 素DOMと同一動作・リークなし |
| T-S04 | ui:"none" | DOM検査 | パネル由来ノード0 |
| T-S05 | スタンドアロン | 単体HTMLをfile://で開く | 内蔵UI＋自動再生で起動 |

### 6.5 色覚・パレット（T-C）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-C01 | 輝度単調 | 各既定パレットで x∈[0,1] 256点の相対輝度 | 単調(許容微小反転なし) |
| T-C02 | P/D型順序 | protanopia/deuteranopia行列で変換後の輝度 | 距離順序保存 |
| T-C03 | 追加パレット検証 | 非単調なパレットを登録 | warning発火(登録は可) |

### 6.6 性能（T-P）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-P01 | 60fps | 1080p・既定パラメータ・10秒計測(CI GPU基準機) | p95フレーム時間 < 16.7ms |
| T-P02 | 上限負荷 | K=6, NP/NC最大 | 劣化曲線を記録(回帰監視) |
| T-P03 | 自動縮退 | 人工的にGPU負荷注入 | pixelRatio→NP→NCの順で縮退＋warning |

### 6.7 エクスポート（T-E）

| ID | 対象 | 手順 | 期待値 |
|---|---|---|---|
| T-E01 | 方式A | 3秒録画 | 再生可能なWebM、ドキュメントにVFR注記 |
| T-E02 | 方式B基本 | 1280×720, 5s, 30fps | ffprobe: 解像度/尺一致、フレーム数=150 |
| T-E03 | CFR検証 | T-E02出力のPTS間隔 | 全フレーム等間隔(タイムベース通り) |
| T-E04 | NTSCタイムベース | fps={30000,1001}, 5s | ffprobe: r_frame_rate=30000/1001、分数保持 |
| T-E05 | フレーム再現 | 同一seed/ExportConfigで2回書き出し | フレームハッシュ列一致 |
| T-E06 | フォールバック | WebCodecs無効環境エミュレート | WebM出力＋fallback=true通知 |
| T-E07 | キャンセル | 50%でcancelExport | 中断・リソース解放・以後の描画正常 |
| T-E08 | 上限クランプ | 4K/120fps指定 | クランプ＋warning＋方式C誘導文言 |
| T-E09 | 変調一致 | frame依存ソース登録、表示スクショ(frame=90)と方式B90フレーム目 | ピクセル一致 |
| T-E10 | 方式C契約 | ジョブJSONをスキーマ検証、往復シリアライズ | スキーマ適合・情報欠落なし |

### 6.8 静的検査（CI常時）

- `window.` へのプロパティ代入、document/windowレベルの入力リスナ禁止
- 数理・位相コードでの `Math.random` / `Date.now` / `performance.now` 禁止（表示ループの1箇所のみ許可リスト）
- GLSL文字列内の禁止関数（非決定論要素）検査

## 7. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| WebGLコンテキスト上限 | 多インスタンス不能 | dispose徹底(T-I05)・非可視時休止・遅延生成 |
| WebCodecs対応差(Safari等) | MP4不可 | 事前isConfigSupported→WebMフォールバック(T-E06)、確実なMP4は方式C |
| 長尺書き出しメモリ | クラッシュ | 逐次エンコード・上限尺・進捗/キャンセル(T-E07) |
| 壁時計依存の混入 | 表示と書き出し不一致 | クロックをP0導入＋静的検査(§6.8)＋T-E09 |
| soft-min数値不安定 | NaN | 下限クランプ・τ下限・NaN保護(T-A11) |
| 非正定値Σ注入 | 距離破綻 | 検証・射影・warning(T-M12) |
| 視覚回帰の環境差 | 偽陽性 | GPU固定のCIランナー・閾値付き比較・基準画像のseed/frame固定 |
| モバイル性能 | フレーム落ち | 自動縮退(T-P03)・reduced-motion |
| 音楽同期の後付け困難化 | 大改修 | 変調バス・audioTrack予約・決定論化経路を初版確保(T-E09が布石の検証) |

## 8. 確定した仕様判断の記録

1. パッケージ形態: FW非依存ESMコア＋Web Component主形態、Reactラッパ初版同梱。
2. seed必須・決定論再現を最優先横断要件とする。
3. 任意コンテナ埋め込み・複数インスタンス・グローバル禁止。
4. 内蔵UIは `ui:"dev"` のみ。本番ヘッドレス。
5. パレット拡張機構＋色覚要件(輝度単調)必須。
6. データ注入は形態A・B両方を初版実装。
7. 距離指標はMetric抽象で差替可能に(実装はマハラノビスのみ)。
8. プリセット・自動再生(API/config両制御)・スタンドアロンHTMLを初版に含む。
9. エクスポートは方式A(VFR/プレビュー限定)＋方式B(CFR保証・有理数タイムベース・NTSC対応・MP4第一/WebMフォールバック)を初版実装。ブラウザ内1080p・fps上限60で確定(120は便益不足で見送り)。4K/長尺は方式C(契約定義のみ)。
10. 音声は初版非対応。決定論クロック・変調バス・audioTrack予約により、将来のオーディオリアクティブ(鑑賞＋リアルタイム/オフライン録画)へコア改変なしで拡張可能とする。

## 9. 実装時の技術判断(オーナー判断不要)

- 縮小推定の係数決定法(Ledoit-Wolf系)の具体選定 → P4-3
- MetricのGLSLチャンク差込粒度(関数単位/マクロ単位) → P4-1で性能比較の上決定
- mp4コンテナmux実装(自前box書き/軽量muxerライブラリ) → P5-2でバンドルサイズと保守性を比較
- 視覚回帰の許容閾値・比較アルゴリズム(SSIM等) → T-V01整備時に決定
