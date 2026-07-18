# 詳細設計仕様書 — MahaFlow: 多次元マハラノビス距離 流体可視化コンポーネント

- ドキュメント種別: 詳細設計仕様書 (Detailed Design Specification)
- 版: 1.0（0.1版および全確定事項を統合。本書が正）
- 最終更新: 2026-07-18
- 対応文書: `20260718-mahaflow-implementation-plan-with-tests.md`
- 準拠モックアップ: `mahalanobis-fluid-mockup-v3.html`

---

## 1. 目的

多次元空間上のマハラノビス距離場を可視化する単一コンポーネントを、次の2用途で提供する。

- **パーツ用途**: 他プロセス／アプリケーションへ埋め込み、宣言的configと命令的APIで制御されるヘッドレス部品
- **鑑賞用途**: 単体で開いて眺める作品。内蔵UI・自動再生・スタンドアロン配布で成立

両用途は共通コアエンジンの上の薄い皮の違いのみであり、機能・数理・描画に差を設けない。最優先の横断要件は**決定論的再現性**（同一入力→同一出力）である。これは (a) パーツとしての信頼性、(b) 動画のフレーム単位再現、(c) 将来の音楽同期、のすべての土台となる。

## 2. 用語

| 用語 | 定義 |
|---|---|
| クラスタ | 平均 μ ∈ Rⁿ・共分散 Σ ∈ Rⁿˣⁿ・重み amp を持つガウス成分 |
| 距離場 | 射影平面上各点の、混合分布に対する合成マハラノビス距離 D(p) |
| グランドツアー | Rⁿ 内で正規直交射影基底を連続回転させる手法 |
| 場ビュー | 距離場を全画面フラットに描く没入視点 (`view: "field"`) |
| 俯瞰ビュー | 3D地形＋点群＋投影床で客観視する視点 (`view: "orbit"`) |
| CFR / VFR | 固定／可変フレームレート |
| タイムベース | フレームレートの有理数表現 `{num, den}`（例 30000/1001） |
| 変調バス | フレーム毎にliveパラメータを外部信号で駆動する機構 |
| ヘッドレス | 内蔵UIを描かず外部制御のみで動く形態 (`ui: "none"`) |

## 3. アーキテクチャ

### 3.1 レイヤ構成

```
ホストアプリ (React / Vue / 素のDOM / サーバジョブ)
   │  属性・props・API・CustomEvent
┌──▼───────────────────────────────────────────┐
│ シェル層                                        │
│  ├ element/maha-flow.ts   Web Component        │
│  └ react/MahaFlow.tsx     React薄ラッパ         │
├──────────────────────────────────────────────┤
│ コア層  MahaFlowCore(container, config)         │
│  ├ core/      ライフサイクル・状態・クロック・    │
│  │            変調バス・プリセット・自動再生       │
│  ├ math/      PRNG・クラスタ・推定・ツアー・       │
│  │            射影・距離抽象(Metric)              │
│  ├ render/    three.jsシーン・GLSL・粒子          │
│  ├ export/    録画A/B・サーバ契約C                │
│  ├ interact/  要素スコープ入力                    │
│  ├ palette/   既定3種＋拡張                       │
│  └ ui/        devパネル(遅延ロード)               │
└──────────────────────────────────────────────┘
```

### 3.2 設計原則

1. **コアはフレームワーク非依存のESMクラス**。DOM要素を1つ受け取り、その内側だけで完結する。
2. **グローバル禁止**: `window` へのプロパティ追加、`window`/`document` レベルの `resize`/`pointer`/`wheel`/`keydown` リスナを禁止。サイズは `ResizeObserver`、入力はコンテナ要素、キーボードはコンテナに `tabindex` を付与してフォーカス時のみ受ける。CIで静的検査する。
3. **`Math.random` / `Date.now` / `performance.now` を数理・位相決定に使うことを禁止**（表示ループのフレーム換算のみ実時間を参照可）。
4. **単方向データフロー**: config/API → 内部state → フレーム評価（変調バス適用）→ uniforms → 描画。描画側からstateを書き戻さない。
5. 複数インスタンスは完全独立（WebGLコンテキスト・状態・PRNG）。`dispose()` で全解放。

### 3.3 フレーム評価パイプライン（毎フレーム）

```
frame n 決定 (表示: rAF経過時間→n換算 / エクスポート: n++)
 → t = n·den/num
 → 自動再生スケジューラ評価（切替・補間）
 → 変調バス評価: params' = apply(params, Σ sources(n))
 → グランドツアー基底 (u,v,w) = tour(t·speed)
 → クラスタ射影: mᵢ, Σ₂ᵢ⁻¹（2×2）
 → uniforms更新 → シーン描画（view/modeで分岐）
 → イベント発火 (hover / statechange 差分時)
```

## 4. 数理仕様

### 4.1 記号

n = `dims`（既定8）、K = `clusterCount`（2..`maxClusters`、既定4）、τ = `softness`（既定0.85）。

### 4.2 seed付き乱数

- PRNG: mulberry32 系の32bit決定論ストリーム。用途別に**サブストリーム**を分岐する（クラスタ生成 / 点群サンプル / 粒子スポーン / 自動再生シャッフル）。分岐は `seed ^ hash(purpose)` で行い、片方の消費が他方へ影響しない。
- 正規乱数: Box–Muller。棄却なし版（log/cos）で消費数を決定論化する。

### 4.3 クラスタ生成

各クラスタ i について:

- μᵢ ~ N(0, spread²·I)、既定 spread = 1.15
- Aᵢ: n×n、各要素 ~ N(0, anisotropy²)、既定 anisotropy = 0.42
- Σᵢ = AᵢAᵢᵀ + εI、ε = 0.05（正定値保証）
- ampᵢ = 0.65 + 0.7·U(0,1)
- **中心化**: 全生成後、Σᵢμᵢ/K を全μから減算し重心を原点へ。

`clusterCount` 変更時は先頭K個を可視化対象とする（`maxClusters` 分は常に生成・保持し、K変更で再生成しない＝表示が跳ねない）。

### 4.4 グランドツアー

- 初期基底 u₀=e₁, v₀=e₂, w₀=e₃。
- 回転平面列 P = [(0,2),(1,3),(2,4),(3,5),(4,6),(5,7),(0,7),(1,6)]、角速度列 ω = [0.131, 0.093, 0.171, 0.077, 0.149, 0.107, 0.059, 0.121]（非通約的）。
- 位相 θₚ = ωₚ·t_tour、t_tour = t·(0.12 + 1.4·speed)。各平面の Givens 回転を順次適用。直交性は構成上保存される。

### 4.5 射影と距離場

- mᵢ = (u·μᵢ, v·μᵢ)、Σ₂ᵢ = [[u·Σᵢu, u·Σᵢv],[u·Σᵢv, v·Σᵢv]]
- det = max(det(Σ₂ᵢ), 1e-5) で正則化して逆行列 [a,b,c]（対称成分）を得る。
- d²ᵢ(p) = a·dx² + 2b·dx·dy + c·dy²、(dx,dy) = p − mᵢ
- s(p) = Σᵢ ampᵢ·exp(−d²ᵢ/τ)（混合密度）
- D(p) = √max(−τ·log(max(s,1e-6)) + τ·log 2.2, 0)
- ∇項: g(p) = Σᵢ wᵢ·∇d²ᵢ / max(s,1e-6)、wᵢ = ampᵢ·exp(−d²ᵢ/τ)、∇d²ᵢ = 2(a·dx+b·dy, b·dx+c·dy)
- 干渉波: wave(p) = Σᵢ ampᵢ·sin(6.5·dᵢ − 1.9t)·exp(−0.42·dᵢ)、dᵢ = √d²ᵢ

これらはGLSL `evalField()` とJS `gradD()` の両方で同一式を実装し、単体テストで相互一致を検証する。

### 4.6 点群（俯瞰）

- サンプル: z ~ N(0,I)ⁿ、x = μᵢ + Aᵢz。真距離 D₈ = ‖z‖ を保持。
- 表示座標 = (u·x, w·x·0.75 + 1.2, v·x)。色 = palette(exp(−0.32·D₈)·0.9+0.06)、サイズ = 2.2+2.8·exp(−0.4·D₈)。
- 既定サンプル数 NC=1500、クラスタへ round-robin 割当。

### 4.7 粒子（場ビュー）

- 既定 NP=5200。スポーンは射影2×2共分散のCholesky分解 L でサンプル: p = mᵢ + Lz。寿命 2.5〜8.0s。
- 速度: v = −0.10·g + 0.75·exp(−0.35D)·g⊥/‖g‖ + 0.44·flow·curl(p,t)。curl は決定論的三角関数場。
- 消滅条件: D > 4.6 または寿命切れ → 再スポーン。
- 残像: フェード板(不透明度0.075、深度書込/テスト無効) + 加算合成点(深度テスト無効)。

### 4.8 地形（俯瞰）

- 密度の山: h = 2.3·s/(s+1.1)
- 距離すり鉢: h = 2.9·(1−exp(−0.42D))
- モード起伏: 波 → +0.22·clamp(wave,±2.2)·(0.25+0.75·exp(−0.28D))、毛細 → +0.20·ridge³·exp(−0.35D)
- 共通ゆらぎ: +0.12·flow·(fbm(1.4p+0.15t)−0.5)
- 法線はフラグメントで dFdx/dFdy による数値法線。投影床は y=−0.55 に等距離線（fract(2.2D)）を描く。

### 4.9 数値保護

- log/sqrt/除算はすべて下限クランプ（1e-6 / 1e-5）。
- τ の下限 0.1。Σ注入時は対称化 (Σ+Σᵀ)/2 → 固有値下限クリップで最近傍正定値化（警告イベント）。
- NaN検出時は当該フレームをスキップし `exporterror`/警告を発火（サイレント破綻禁止）。

## 5. 型定義（正規のAPI契約）

```ts
type Timebase = number | { num: number; den: number };   // 24|25|30|50|60 or {24000,1001}等

interface ClusterInput { mu: number[]; sigma: number[][]; amp?: number }
interface RawData     { points: number[][]; labels?: number[] }

interface LiveParams {
  clusterCount: number;      // 2..maxClusters
  spread: number;            // 0.2..3    既定1.15
  anisotropy: number;        // 0.05..1   既定0.42
  softness: number;          // 0.1..3    既定0.85 (τ)
  amp: number[];             // 長さmaxClusters
  mode: 0|1|2|3;             // なめらか|波|毛細|粒子 (内部表現; シェーダは0..2+粒子フラグ)
  terrain: 0|1;              // 密度の山|距離すり鉢
  palette: string;           // パレット名
  isoDensity: number;        // 0..1 既定0.55
  flow: number;              // 0..1 既定0.45
  view: "field"|"orbit";
  zoom: number;              // 0.25..12
  pan: [number, number];
  orbit: { theta:number; phi:number; r:number; tx:number; ty:number; tz:number };
  playing: boolean;
  speed: number;             // 0..1 既定0.30
}

interface InitConfig {
  seed: number;                              // 必須
  dims?: number;                             // 既定8
  maxClusters?: number;                      // 既定6
  data?: ClusterInput[] | RawData | null;
  metric?: "mahalanobis";
  palettes?: PaletteDef[] | null;
  presets?: PresetDef[] | null;
  preset?: string | null;
  autoplay?: AutoplayConfig | false;
  ui?: "dev" | "none";                       // 既定 "none"
  pixelRatio?: number;
}

interface AutoplayConfig {
  interval: number;                          // 秒
  sequence: "randomize" | string[] | "shuffle";
  transition?: "cut" | "crossfade";
  transitionSec?: number;
}

interface PresetDef { name: string; state: Partial<LiveParams> & { seed?: number } }
interface PaletteDef { name: string; freq: [number,number,number]; phase: [number,number,number] }

type ModulationSource = (frame: number) => Partial<LiveParams>;

interface ExportConfig {
  mode: "realtime" | "offline";
  width: number; height: number;             // ブラウザ内: 最大1920×1080
  duration: number;                          // 秒
  fps?: Timebase;                            // 既定30・上限60(実効値)
  format?: "mp4" | "webm";                   // mp4=WebCodecs H.264、非対応でwebmへ自動フォールバック
  startFrame?: number;
  bitrate?: number;
  audioTrack?: unknown;                      // 予約（初版未使用）
}

interface State extends LiveParams {
  seed: number;
  frame: number;                             // 決定論クロック位置
  clusters: { mu:number[]; sigma:number[][]; amp:number }[];
  autoplay: (AutoplayConfig & { index:number }) | false;
}
```

### 5.1 MahaFlowCore API

```ts
class MahaFlowCore {
  constructor(container: HTMLElement, config: InitConfig);
  readonly ready: Promise<void>;

  setConfig(partial: Partial<LiveParams>): void;   // liveのみ。init-onlyキーは警告し無視
  getState(): State;                                // frame含む完全再現情報
  randomize(seed?: number): void;
  setData(data: ClusterInput[] | RawData): void;
  resetView(): void;
  play(): void;  pause(): void;

  applyPreset(name: string): void;
  savePreset(name: string): PresetDef;
  listPresets(): string[];
  startAutoplay(cfg?: AutoplayConfig): void;
  stopAutoplay(): void;

  addModulation(src: ModulationSource): () => void; // 解除関数を返す
  clearModulation(): void;

  exportVideo(cfg: ExportConfig): Promise<Blob>;
  cancelExport(): void;

  on(event: MahaEvent, cb: (payload:any)=>void): () => void;
  dispose(): void;                                  // 以後の呼び出しは no-op + 警告
}
```

### 5.2 イベント

| イベント | ペイロード | 発火条件 |
|---|---|---|
| `ready` | `{}` | 初期化完了（シェーダコンパイル後） |
| `statechange` | `State` | API/UI/自動再生でstateが変化した時（フレーム変化では発火しない） |
| `hover` | `{ D:number, x:number, y:number }` | 場ビューでポインタ移動時（スロットル） |
| `warning` | `{ code, message }` | 正定値射影・init-onlyキー無視 等 |
| `exportprogress` | `{ frame, totalFrames, ratio }` | 書き出し中 |
| `exportdone` | `{ blob, format, fallback:boolean }` | 完了 |
| `exporterror` | `{ reason }` | 失敗・NaN検出 |

Web Component では同名を `maha-` プレフィックスの `CustomEvent` で発火する。

### 5.3 Web Component 属性マッピング

`<maha-flow seed="42" view="orbit" mode="wave" terrain="bowl" palette="aurora" preset="calm-sea" autoplay='{"interval":20,"sequence":"randomize"}'>`。属性は文字列→型変換して config/live に束縛。プロパティアクセスで `core` を公開する。

## 6. 表現仕様

### 6.1 マトリクス

視点2（field/orbit）× 表現4（smooth/particle/wave/capillary）× 地形2（俯瞰のみ）× パレットn。全組合せが例外なく描画されること（表現×視点の意味は 0.1版 §6 の表のとおり。粒子×俯瞰は曲面・床を消し点群散布のみ）。

### 6.2 パレット

- 定義: IQ式コサインパレット `color(x) = 0.5 + 0.5·cos(2π(freq·x + phase))`。
- 既定3種: 極光 aurora / 深海 abyss / 曙 dawn（係数はモックアップv3の値を正とする）。
- **色覚要件（必須）**: 距離→輝度が単調であること。CIE相対輝度で単調性を数値検証し、P型・D型シミュレーション下でも順序が保たれること。
- `palettes` config で追加・置換可。GLSLへは freq/phase を uniform 渡しし、シェーダ再コンパイルなしで切替える。

### 6.3 内蔵UI（devパネル）

`ui:"dev"` のときのみ動的 import しDOMを生成。コントロール一覧はモックアップv3のパネルを正とし、加えてプリセット選択・自動再生トグル・書き出しボタン（方式選択・進捗表示）を持つ。パネルはliveパラメータへの薄い束縛であり、描画結果に影響する状態を持たない。

## 7. 決定論クロック・変調バス

### 7.1 クロック

- 位相はフレーム番号 n とタイムベースから t = n·den/num で導出。整数fpsは den=1。
- 表示ループ: rAFの経過実時間 Δ を Δ·num/den フレームに換算し、n を実数で進める（描画は連続位相）。エクスポート: n を整数で1ずつ進める。
- `prefers-reduced-motion`: n の進行係数を0.1へ低減し、自動再生の切替を停止する。
- `getState().frame` からの再開で同一位相を復元できる。

### 7.2 変調バス

- 各フレームで登録順にソースを評価し、返却された `Partial<LiveParams>` を浅くマージして当該フレームの実効パラメータとする（内部stateは書き換えない＝非破壊。`getState()` は基底stateを返し、変調は `getState({resolved:true})` で取得可）。
- ソースが frame のみに依存すれば、表示と方式Bエクスポートの動きは同一になる（決定論条件）。
- 自動再生の補間（クロスフェード）は内部的にこのバス上の一時ソースとして実装する。
- 将来のオーディオリアクティブは「音声→フレーム別特徴量列→ModulationSource」の経路で、コア改変なしに接続する（0.1版 §21 の3経路を継承）。

## 8. プリセット・自動再生

- プリセット = `getState()` 準拠のスナップショット（seed含む）に名前を付けたもの。既定プリセットを最低4種同梱（各表現モードの代表設定）。`savePreset`→`applyPreset` の往復で同一の絵。
- 自動再生: `interval` 秒ごとに `sequence` に従い遷移。`"randomize"` はPRNGサブストリームから新seedを導出（決定論）。`"shuffle"` は登録プリセットを決定論シャッフル。遷移はcut/crossfade。切替タイミングはフレーム基準（壁時計不使用）。

## 9. データ注入

### 9.1 形態A（μ・Σ直接）

- 検証: 次元一致、σ対称、正定値。非正定値は固有値クリップで最近傍射影し `warning` 発火（`strict:true` オプションで例外化）。
- 注入後も中心化・射影・距離の経路は生成時と完全同一。

### 9.2 形態B（生データ推定）

- `labels` 有→ラベル毎、無→単一集団。平均=標本平均、共分散=標本共分散。
- 標本数 < 2·dims の場合は縮小推定（対角シュリンク、係数は Ledoit-Wolf 系を実装時選定）で正定値担保。
- 推定結果は形態Aに正規化して保持し、`getState().clusters` から取得・再注入可能。

## 10. 距離指標の抽象化（Metric）

```ts
interface Metric {
  id: string;                                   // "mahalanobis"
  glslChunk: string;                            // d2(p, params) と grad を返すGLSL断片
  jsEval(p:[number,number], proj: ProjCluster): { d2:number; grad:[number,number] };
  projectParams(cluster, u, v): ProjCluster;    // N次元→シェーダuniform表現
}
```

- コア・シェーダは `Metric` 契約のみに依存する。GLSLはチャンク差込でビルドし、指標追加時にパイプライン改変を不要とする。
- 初版実装はマハラノビスのみ。ユークリッド等は後続（非スコープ）。

## 11. 動画エクスポート

### 11.1 共通

- ExportConfig は §5 の定義を正とする。アスペクト比は width/height で決まる。ブラウザ内上限 1920×1080・fps上限60（実効値）。
- fpsはタイムベース `{num,den}` として保持。NTSC系プリセット 23.976=24000/1001, 29.97=30000/1001, 59.94=60000/1001 と 24/25/30/50/60 を提供。

### 11.2 方式A: リアルタイム録画

- `canvas.captureStream()` + MediaRecorder。WebM中心・**実質VFR**。編集用途非推奨・プレビュー限定をAPIドキュメントに明記。

### 11.3 方式B: オフライン決定論録画（既定・推奨）

- 表示ループを停止し、オフスクリーンターゲット（指定解像度）へ n=startFrame から整数フレームを逐次描画、WebCodecs `VideoEncoder` へチャンク投入（フレーム蓄積なし）。
- **CFR保証**: 各フレームの timestamp = n·den/num·10⁶ μs を有理数から整数演算で付与し、浮動小数の累積誤差を排除。コンテナのタイムベースにも分数のまま記録し、編集ソフトが再解釈なしにCFR素材として読めること。
- MP4(H.264) 第一候補。`VideoEncoder.isConfigSupported` で事前確認し、非対応は WebM(VP9) へ自動フォールバック（`exportdone.fallback=true`）。
- 進捗 `exportprogress`、`cancelExport()` で中断・解放。書き出し中の表示は静止＋進捗表示とする。
- 同一 seed・同一 ExportConfig・同一変調ソースで出力はフレーム単位に再現される。

### 11.4 方式C: サーバレンダリング（契約のみ）

- 入力: `{ state: State, export: ExportConfig, modulationTable?: number[][] }` のJSON。出力: 動画ファイル＋メタデータ。
- 4K以上・長尺はこの方式に限定。コアの決定論性により、ブラウザ／サーバで同一フレームが得られることを契約前提とする。実装は後続。

## 12. 埋め込み・ライフサイクル

- コンストラクタでcanvas生成・シェーダコンパイル・`ResizeObserver` 登録。`ready` 解決後に描画開始。
- コンテナサイズ0の間は描画をスキップ（表示時に自動再開）。`IntersectionObserver` で非可視時にループを休止（省電力）。
- `dispose()`: ループ停止 → Observer/リスナ解除 → three.jsリソース(geometry/material/target)個別dispose → `WEBGL_lose_context` でコンテキスト解放 → 以後のAPIはno-op+警告。
- 同一ページ3インスタンス以上の共存を動作保証（受け入れ基準）。

## 13. 性能要件

- 目標: 1080p・中位GPUで60fps、モバイルで30fps以上（既定パラメータ）。
- 予算（1フレーム）: CPU ≤ 4ms（射影 O(K·n²) ＋粒子 O(NP·K)）、GPU ≤ 8ms。
- 自動品質調整: 実測フレーム時間が閾値超過を継続した場合、pixelRatio → NP → NC の順に段階的縮退し `warning` で通知（エクスポートでは縮退しない）。

## 14. アクセシビリティ・セキュリティ

- コンテナに `role="img"` と距離場の `aria-label`。キーボード操作（R/V/T/1-4/0）はフォーカス時のみ。フォーカスリング維持。
- `prefers-reduced-motion` 対応（§7.1）。
- 外部入力（data/preset/palette JSON）はスキーマ検証し、文字列をHTMLへ挿入しない（devパネルは textContent のみ）。

## 15. エラー処理方針

| 状況 | 挙動 |
|---|---|
| init-onlyキーを setConfig | 無視＋`warning` |
| 非正定値Σ注入 | 最近傍射影＋`warning`（strictで例外） |
| 次元不一致データ | 例外（同期的） |
| WebCodecs非対応 | WebMフォールバック＋`exportdone.fallback` |
| 解像度/fps上限超過 | クランプ＋`warning`。4K指定は方式C誘導メッセージ |
| WebGLコンテキストロスト | 自動復帰試行→復帰時 `warning`、不可なら `exporterror` 相当の致命イベント |
| dispose後のAPI | no-op＋`warning` |

## 16. 受け入れ基準（最終・18項目）

1. 同一 seed・同一 config で開始フレームがピクセル一致範囲内で再現される。
2. 1ページ3インスタンスが独立動作し、`dispose()` でWebGLコンテキストが解放される。
3. `ui:"none"` で内蔵UI由来のDOMが一切生成されない。
4. 表現4×視点2×地形2×既定パレット3の全組合せが例外なく描画される。
5. 形態A注入が生成時と同一経路で描画される。
6. 形態B推定が、同じμ・Σを形態Aで与えた場合と一致する（許容誤差内）。
7. Reactラッパ経由でも素DOMと同一の動作・再現性。
8. 既定パレットが輝度単調で、P型・D型シミュレーション下でも距離順序を保つ。
9. `Metric` 契約でマハラノビス実装が動作し、距離計算が差替可能な構造である。
10. プリセットの save→apply 往復が同一の絵を再現する。
11. 自動再生が config・API 双方から開始/停止でき、巡回中の任意時点を `getState()` で再現できる。
12. スタンドアロン単体HTMLがダブルクリックのみで鑑賞用途として成立する（内蔵UI＋自動再生）。
13. 方式Bの出力が指定解像度・尺・タイムベースに一致するCFRで、同一入力でフレーム単位に再現され、編集ソフト（ffprobe検証で代替可）が再解釈なしに読み込める。
14. 方式Aで表示中の動きが録画でき、A/BがAPIで明示的に選択できる。
15. MP4非対応環境でWebMへ自動フォールバックし、通知される。
16. 決定論的 ModulationSource が表示と方式B出力で同一の動きを与える。
17. `prefers-reduced-motion` でアニメーション・自動再生切替が明確に低減する。
18. 1080p・中位GPU・既定パラメータで60fpsを満たす。
