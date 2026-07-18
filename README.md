# mahaflow

多次元マハラノビス距離 流体可視化コンポーネント (MahaFlow)。

- 詳細設計仕様: [`docs/20260718-mahaflow-detailed-design-spec.md`](docs/20260718-mahaflow-detailed-design-spec.md)
- 実装計画・テスト設計: [`docs/20260718-mahaflow-implementation-plan-with-tests.md`](docs/20260718-mahaflow-implementation-plan-with-tests.md)

## 実装状況

計画書のフェーズ WBS（P0〜P5）のうち、**P0**・**P1**・**P2a**・**P2bの一部**・**P3**・**P4**・**P5** を実装済み。

| フェーズ | 内容 | 状態 |
|---|---|---|
| P0 | seed PRNG・サブストリーム・クラスタ生成・グランドツアー・射影/距離場・決定論クロック・`MahaFlowCore` 骨格(mount/resize/dispose)・場ビュー(なめらか)描画 | 実装済み |
| P1 | InitConfig/LiveParams スキーマ・既定値・クランプ、`setConfig`/`getState`/`randomize`/`play`/`pause`、イベント基盤、エラー処理方針 | 実装済み |
| P2a | 場ビューのwave/capillaryモード、パレット機構(aurora/abyss/dawn+追加API)、要素スコープ入力(ズーム/パン)、変調バス、プリセット | 実装済み |
| P2b (自動再生・数理) | `startAutoplay`/`stopAutoplay`(randomize/shuffle/配列シーケンス、フレーム基準)、点群サンプリング(§4.6)・粒子スポーン/速度/寿命(§4.7)の数理参照実装 | 実装済み(数理のみ、GPU描画は未接続) |
| P2b (描画) | 俯瞰ビュー(地形メッシュ・投影床・点群描画)、場ビュー粒子系(GPU point-sprite)、crossfade遷移、reduced-motion時の自動品質調整 | 未着手 |
| P3 | Web Component `<maha-flow>`・Reactラッパ・devパネル(遅延ロード)・スタンドアロン単体HTML | 実装済み |
| P4 | `Metric`抽象、データ注入 形態A(μ・Σ直接)・形態B(生データ推定/縮小推定)、色覚検証(輝度単調性・P/D型シミュレーション) | 実装済み |
| P5 | 動画エクスポート 方式A(リアルタイム)・方式B(オフライン決定論CFR)・方式C(サーバジョブ契約) | 実装済み |

実装済みモジュール:

```
src/
├─ math/     prng.ts / linalg.ts(固有値分解・PD射影含む) / cluster.ts / tour.ts /
│            project.ts / metric.ts(Metric契約) / dataInjection.ts(形態A) /
│            estimate.ts(形態B) / pointcloud.ts(俯瞰点群, §4.6) / particles.ts(粒子, §4.7)
├─ core/     clock.ts / rafLoop.ts / config.ts / state.ts / events.ts /
│            modulation.ts / presets.ts / autoplay.ts / MahaFlowCore.ts / types.ts
├─ render/   fieldView.ts / shaders/field.glsl.ts
├─ palette/  palettes.ts / luminance.ts(輝度単調性・CVD検証)
├─ interact/ pointer.ts (hover用screen→field変換) / controls.ts (ズーム/パン)
├─ export/   offline.ts(方式B, Mediabunny) / realtime.ts(方式A) / serverContract.ts(方式C)
├─ ui/       devPanel.ts (ui:"dev"時のみ動的import)
├─ element/  maha-flow.ts (Web Component)
├─ react/    MahaFlow.tsx (Reactラッパ)
└─ index.ts
standalone/  main.ts / template.html → npm run build:standalone で index.html を生成
```

対応テスト（`docs/...implementation-plan-with-tests.md` §6 ID対応）:
T-M01〜T-M15, T-A01〜T-A05, T-A07〜T-A10, T-A12〜T-A14, T-D01〜T-D02,
T-I01〜T-I05, T-S01〜T-S05, T-C01〜T-C03, T-E02〜T-E03, T-E07〜T-E10
(Vitest 99テスト + Playwright 6本)。

未対応:
T-A06(state往復のピクセル一致。視覚回帰は未整備のため保留),
T-A11(NaN保護の網羅的検証。基本ガードは実装済みだが専用テストは未追加),
T-V01〜T-V08(場ビュー以外の視覚回帰。俯瞰ビュー等が未描画のため対象外)、
T-E01(方式A/MediaRecorderの実キャプチャ検証)、T-E04〜T-E06(NTSCタイムベース/
フレームハッシュ再現/WebCodecsフォールバックの専用検証)。

## セットアップ

```sh
npm install
npm run check                # lint + typecheck + test
npm run build                 # npm/Web Component/Reactの各エントリをビルド
npm run build:standalone      # standalone/index.html を生成
npx playwright install --with-deps chromium   # 初回のみ
npx playwright test           # standalone起動(T-S05)・動画書き出し(T-E*)を実ブラウザで検証
```

Playwrightのvisualテストの一部(`test/visual/exportModulation.spec.ts`)は
`dist/maha-flow.js`をブラウザから直接importするため、事前に`npm run build`が
必要です。`playwright.config.ts`が`scripts/static-server.mjs`を自動起動する
ため(file://はモジュール間importをCORSでブロックするため使用)、個別に
サーバーを立てる必要はありません。

## 動画書き出しガイド(P5)

- **方式A(`mode:"realtime"`)**: `canvas.captureStream()`+`MediaRecorder`。表示中の動きをそのまま録画するプレビュー用。VFR(可変フレームレート)なので編集用途には非推奨
- **方式B(`mode:"offline"`、既定・推奨)**: 表示ループを止め、`n=startFrame`から整数フレームを逐次描画し、[Mediabunny](https://github.com/Vanilagy/mediabunny)の`CanvasSource`へ有理数タイムベース由来の厳密なタイムスタンプ(`frameToTime(n, fps)`秒)で投入。MP4(H.264)を`canEncodeVideo`で確認しダメならWebM(VP9)へ自動フォールバック(`exportdone.fallback=true`)
- **方式C**: `export/serverContract.ts`のジョブ契約(`{state, export, modulationTable?}`)のみ実装。実際のサーバレンダリングは未実装
- 解像度は1920×1080、fpsは60を超えると自動クランプ+`warning`。4K以上は方式Cへの誘導`warning`を発火
- `exportVideo()`実行中は表示ループを停止し、完了・キャンセル・エラーいずれの経路でも元のキャンバスサイズ・表示ループへ復帰する
- `cancelExport()`で中断可能。中断時はエンコーダ/マルチプレクサのリソースを解放し、以後の通常描画に影響しない

## 既知の未実装範囲・注意点

- 俯瞰ビュー(`view:"orbit"`)は`LiveParams`として保持されるが専用レンダラは未実装。地形メッシュ・投影床・orbitカメラ操作は今後の作業
- 場ビューの`mode:3`(particle)はGPU point-sprite系が未実装のため、現状smoothへフォールバックして描画される。`math/particles.ts`にスポーン/速度/寿命の数理参照実装のみ存在
- 自動再生の`transition:"crossfade"`はcut(即時切替)にフォールバックし`warning`を発火。補間実装は未着手
- 自動品質調整(pixelRatio→粒子数→点群数の縮退)は粒子/点群のGPU描画自体が未実装のため未着手
- devパネルのコントロール一覧はモックアップv3のパネル構成が本リポジトリに無いため、仕様書§5のLiveParamsから妥当と判断した最小セット(クラスタ数/spread/anisotropy/softness/zoom/mode/play/preset)。書き出しボタンは未搭載(P5は実装済みのため今後追加可能)
- `Metric`抽象は契約定義とマハラノビス実装・JS参照実装のクロス検証(T-M11)まで実装済みだが、`render/fieldView.ts`のGLSLは現状`metric.glslChunk`を差し込む形ではなく直接実装のまま(チャンク差込みへの配線は後続作業)
- パレット既定3種の係数は、輝度単調性(§6.2必須要件)を満たすよう`monotonicPalette()`で構成した暫定値。粒子のcurlノイズ式も含め、モックアップHTML(`mahalanobis-fluid-mockup-v3.html`)が本リポジトリに存在しないため正式係数は資産入手後に差し替え要
- 方式Cのサーバレンダリング実装本体、ffprobeによるコンテナ検証、NTSCタイムベース(30000/1001等)の専用テストは未着手
- 視覚回帰(T-V*)は未整備。Playwrightはstandalone起動確認・動画書き出し検証のみ導入済み
