# mahaflow

多次元マハラノビス距離 流体可視化コンポーネント (MahaFlow)。

- 詳細設計仕様: [`docs/20260718-mahaflow-detailed-design-spec.md`](docs/20260718-mahaflow-detailed-design-spec.md)
- 実装計画・テスト設計: [`docs/20260718-mahaflow-implementation-plan-with-tests.md`](docs/20260718-mahaflow-implementation-plan-with-tests.md)

## 実装状況

計画書のフェーズ WBS（P0〜P5）のうち、**P0（基盤: コア分離・決定論）** を実装済み。

| フェーズ | 内容 | 状態 |
|---|---|---|
| P0 | seed PRNG・サブストリーム・クラスタ生成・グランドツアー・射影/距離場・決定論クロック・`MahaFlowCore` 骨格(mount/resize/dispose)・場ビュー(なめらか)描画 | 実装済み |
| P1 | config/state/API/イベント全体 | 未着手 |
| P2 | 表現網羅(4表現×2視点×2地形)・入力・パレット・変調バス・プリセット・自動再生 | 未着手 |
| P3 | Web Component・Reactラッパ・スタンドアロンHTML | 未着手 |
| P4 | データ注入(形態A/B)・Metric抽象・色覚検証 | 未着手 |
| P5 | 動画エクスポート(方式A/B/C) | 未着手 |

P0で実装したモジュール:

```
src/
├─ math/    prng.ts / linalg.ts / cluster.ts / tour.ts / project.ts
├─ core/    clock.ts / rafLoop.ts / MahaFlowCore.ts / types.ts
├─ render/  fieldView.ts / shaders/field.glsl.ts
└─ index.ts
```

対応テスト（`docs/...implementation-plan-with-tests.md` §6 ID対応）: T-M01〜T-M10, T-A01, T-I01, T-I05。

## セットアップ

```sh
npm install
npm run check   # lint + typecheck + test
npm run build
```

## 既知の未実装範囲

- `setConfig`/`getState`/イベント/プリセット/自動再生などのAPI全体（P1・P2）
- wave/capillary/particle表現、俯瞰ビュー、地形、パレット切替UI（P2）
- Web Component `<maha-flow>`・Reactラッパ・devパネル・スタンドアロンHTML（P3）
- データ注入(形態A/B)・`Metric`抽象・色覚検証（P4）
- 動画エクスポート方式A/B/C（P5）
- Playwrightによる視覚回帰・統合テスト、ffprobeによるエクスポート検証（本PRはVitestのみ）
