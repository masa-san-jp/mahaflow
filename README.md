# mahaflow

多次元マハラノビス距離 流体可視化コンポーネント (MahaFlow)。

- 詳細設計仕様: [`docs/20260718-mahaflow-detailed-design-spec.md`](docs/20260718-mahaflow-detailed-design-spec.md)
- 実装計画・テスト設計: [`docs/20260718-mahaflow-implementation-plan-with-tests.md`](docs/20260718-mahaflow-implementation-plan-with-tests.md)

## 実装状況

計画書のフェーズ WBS（P0〜P5）のうち、**P0**・**P1**・**P2a**・**P2bの一部（自動再生・点群/粒子の数理）** を実装済み。

| フェーズ | 内容 | 状態 |
|---|---|---|
| P0 | seed PRNG・サブストリーム・クラスタ生成・グランドツアー・射影/距離場・決定論クロック・`MahaFlowCore` 骨格(mount/resize/dispose)・場ビュー(なめらか)描画 | 実装済み |
| P1 | InitConfig/LiveParams スキーマ・既定値・クランプ、`setConfig`/`getState`/`randomize`/`play`/`pause`、イベント基盤、エラー処理方針 | 実装済み |
| P2a | 場ビューのwave/capillaryモード、パレット機構(aurora/abyss/dawn+追加API)、要素スコープ入力(ズーム/パン)、変調バス、プリセット | 実装済み |
| P2b (自動再生・数理) | `startAutoplay`/`stopAutoplay`(randomize/shuffle/配列シーケンス、フレーム基準)、点群サンプリング(§4.6)・粒子スポーン/速度/寿命(§4.7)の数理参照実装 | 実装済み(数理のみ、GPU描画は未接続) |
| P2b (描画) | 俯瞰ビュー(地形メッシュ・投影床・点群描画)、場ビュー粒子系(GPU point-sprite)、crossfade遷移、reduced-motion時の自動品質調整 | 未着手 |
| P3 | Web Component・Reactラッパ・スタンドアロンHTML | 未着手 |
| P4 | データ注入(形態A/B)・Metric抽象・色覚検証 | 未着手 |
| P5 | 動画エクスポート(方式A/B/C) | 未着手 |

実装済みモジュール:

```
src/
├─ math/     prng.ts / linalg.ts / cluster.ts / tour.ts / project.ts /
│            pointcloud.ts (俯瞰点群, §4.6) / particles.ts (粒子, §4.7)
├─ core/     clock.ts / rafLoop.ts / config.ts / state.ts / events.ts /
│            modulation.ts / presets.ts / autoplay.ts / MahaFlowCore.ts / types.ts
├─ render/   fieldView.ts / shaders/field.glsl.ts
├─ palette/  palettes.ts
├─ interact/ pointer.ts (hover用screen→field変換) / controls.ts (ズーム/パン)
└─ index.ts
```

対応テスト（`docs/...implementation-plan-with-tests.md` §6 ID対応）:
T-M01〜T-M10, T-A01〜T-A05, T-A07〜T-A09, T-A12〜T-A14, T-D01〜T-D02, T-I01〜T-I05。

未対応:
T-A06(state往復のピクセル一致。視覚回帰はPlaywright未整備のため保留),
T-A10(データ注入時の次元不一致。P4のsetData実装後),
T-A11(NaN保護の網羅的検証。基本ガードは実装済みだが専用テストは未追加),
T-V*(視覚回帰。Playwright未導入)、T-C*(色覚検証。P4)、
T-E*(動画エクスポート。P5)。

## セットアップ

```sh
npm install
npm run check   # lint + typecheck + test
npm run build
```

## 既知の未実装範囲・注意点

- 俯瞰ビュー(`view:"orbit"`)は`LiveParams`として保持されるが専用レンダラは未実装。地形メッシュ・投影床・orbitカメラ操作は今後の作業
- 場ビューの`mode:3`(particle)はGPU point-sprite系が未実装のため、現状smoothへフォールバックして描画される。`math/particles.ts`にスポーン/速度/寿命の数理参照実装のみ存在
- 自動再生の`transition:"crossfade"`はcut(即時切替)にフォールバックし`warning`を発火。補間実装は未着手
- 自動品質調整(pixelRatio→粒子数→点群数の縮退)は粒子/点群のGPU描画自体が未実装のため未着手
- Web Component `<maha-flow>`・Reactラッパ・devパネル・スタンドアロンHTML（P3）
- データ注入(形態A/B)・`Metric`抽象・色覚検証（P4）
- 動画エクスポート方式A/B/C（P5）
- Playwrightによる視覚回帰・統合テスト、ffprobeによるエクスポート検証（本PRまでVitestのみ）
- パレット既定3種の係数、粒子のcurlノイズ式は、モックアップHTML(`mahalanobis-fluid-mockup-v3.html`)が本リポジトリに存在しないため暫定値。正式係数は資産入手後に差し替え要
