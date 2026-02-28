# 技術設計書: Shopify MMM App

> CTO壁打ち結果に基づく技術アーキテクチャ設計

---

## 1. システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                   システムアーキテクチャ                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【フロントエンド】                                              │
│  ├── React Router (Shopify CLIテンプレート)                      │
│  ├── Polaris Web Components (UI)                                 │
│  ├── App Bridge (Shopify Admin統合)                              │
│  └── Recharts (グラフ描画)                                      │
│                                                                 │
│  【バックエンド (Node.js)】                                      │
│  ├── Shopify GraphQL Admin API クライアント                      │
│  │   ├── ShopifyQL → 売上/注文/PV/セッション取得                 │
│  │   ├── Orders API → 注文詳細・割引情報取得                     │
│  │   └── Inventory API → 在庫スナップショット                    │
│  ├── Excelパーサー (exceljs)                                     │
│  │   ├── テンプレートDL生成                                      │
│  │   ├── アップロードバリデーション                              │
│  │   └── 結果Excel生成（optimize.xlsm互換）                     │
│  ├── データマージエンジン                                        │
│  │   └── Shopify自動データ + Excelアップロードデータ → 統合CSV    │
│  └── Billing (Managed Pricing)                                   │
│                                                                 │
│  【MMM計算エンジン (Python)】                                    │
│  ├── LightweightMMM or PyMC-Marketing                            │
│  ├── ワーカープロセス (非同期実行)                               │
│  │   └── Queue: BullMQ (Redis)                                   │
│  ├── 入力: 統合CSV                                              │
│  ├── 出力: モデル結果JSON + 可視化データ                        │
│  └── 結果キャッシュ (PostgreSQL)                                 │
│                                                                 │
│  【インフラ】                                                    │
│  ├── ホスティング: Railway / Render                              │
│  ├── DB: PostgreSQL (Prisma ORM)                                 │
│  ├── ファイルストレージ: S3互換 (アップロード/結果Excel)         │
│  ├── ジョブキュー: Redis + BullMQ                                │
│  └── CI/CD: GitHub Actions                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 技術選定

### 2.1 MMMエンジン

| エンジン | 言語 | サーバー運用 | 精度 | 採用判断 |
|---|---|---|---|---|
| Robyn | R | 困難（Rサーバー必要） | 高い | MVP後に検討 |
| **LightweightMMM** | Python | 容易 | 高い（ベイジアン） | **v1推奨** |
| **PyMC-Marketing** | Python | 容易 | 高い（ベイジアン） | **v1推奨** |
| 自前Ridge実装 | Python | 最も容易 | 中程度 | 最速MVP用 |

**判断**: PythonベースのLightweightMMM or PyMC-Marketingを採用。
Robynは実績があるがRのサーバー運用が困難。

### 2.2 フレームワーク

| 選択肢 | 採用 | 理由 |
|---|---|---|
| Remix | 不採用 | Shopify公式が2025年にReact Routerに移行 |
| **React Router** | **採用** | Shopify CLI最新テンプレート準拠 |

### 2.3 データベース

| 選択肢 | 採用 | 理由 |
|---|---|---|
| MongoDB | 不採用 | Prisma ORMとの相性が劣る |
| **PostgreSQL** | **採用** | Prisma ORM対応、Shopifyアプリのデファクト |

### 2.4 ホスティング

| 選択肢 | 採用 | 理由 |
|---|---|---|
| AWS ECS | 将来 | スケール時に移行 |
| **Railway / Render** | **MVP採用** | コスト効率、セットアップ容易 |

---

## 3. データベーススキーマ（Prisma）

```prisma
model Shop {
  id          String   @id @default(cuid())
  shopDomain  String   @unique  // xxx.myshopify.com
  accessToken String
  plan        Plan     @default(TRIAL)
  trialEndsAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  analyses    Analysis[]
  dataSources DataSource[]
}

model DataSource {
  id        String         @id @default(cuid())
  shop      Shop           @relation(fields: [shopId], references: [id])
  shopId    String
  type      DataSourceType // SHOPIFY_AUTO, EXCEL_UPLOAD, API_GOOGLE, API_META
  status    String         // SYNCING, READY, ERROR
  lastSync  DateTime?
  metadata  Json?          // API credentials, file info, etc.
  createdAt DateTime       @default(now())

  dataPoints DailyDataPoint[]
}

model DailyDataPoint {
  id           String     @id @default(cuid())
  dataSource   DataSource @relation(fields: [dataSourceId], references: [id])
  dataSourceId String
  date         DateTime   @db.Date
  variable     String     // revenue, orders, google_imp, meta_spend, etc.
  value        Float
  createdAt    DateTime   @default(now())

  @@unique([dataSourceId, date, variable])
  @@index([dataSourceId, date])
}

model Analysis {
  id          String        @id @default(cuid())
  shop        Shop          @relation(fields: [shopId], references: [id])
  shopId      String
  status      AnalysisStatus // PENDING, RUNNING, COMPLETED, FAILED
  config      Json           // チャネル設定、期間、目的変数等
  startedAt   DateTime?
  completedAt DateTime?
  results     Json?          // モデル結果（チャネル貢献度、R²等）
  errorMsg    String?
  createdAt   DateTime       @default(now())

  @@index([shopId, createdAt])
}

enum Plan {
  TRIAL
  STARTER
  GROWTH
  PRO
}

enum DataSourceType {
  SHOPIFY_AUTO
  EXCEL_UPLOAD
  API_GOOGLE
  API_META
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

---

## 4. API エンドポイント設計

### 4.1 データ管理

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/data/shopify` | Shopify自動取得データの取得・同期 |
| GET | `/api/data/preview` | 統合データのプレビュー |
| GET | `/api/data/template` | Excelテンプレートのダウンロード |
| POST | `/api/data/upload` | Excelファイルのアップロード＆バリデーション |
| DELETE | `/api/data/:id` | データソースの削除 |

### 4.2 分析実行

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/analysis` | MMM分析の実行開始 |
| GET | `/api/analysis/:id` | 分析結果の取得 |
| GET | `/api/analysis/:id/status` | 分析実行状態のポーリング |
| GET | `/api/analysis/:id/download` | 結果Excelのダウンロード |
| GET | `/api/analysis` | 過去の分析結果一覧 |

### 4.3 設定

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/settings` | アプリ設定の取得 |
| PUT | `/api/settings` | アプリ設定の更新 |

### 4.4 GDPR Webhooks

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/webhooks/customers-data-request` | 顧客データリクエスト |
| POST | `/api/webhooks/customers-redact` | 顧客データ削除 |
| POST | `/api/webhooks/shop-redact` | ショップデータ削除 |

---

## 5. ディレクトリ構成

```
shopify-mmm-app/
├── app/                          # Shopifyアプリ（React Router + Node.js）
│   ├── routes/                   # ページルーティング
│   │   ├── app._index.tsx        # ダッシュボード
│   │   ├── app.data.tsx          # データ準備画面
│   │   ├── app.analysis.tsx      # 分析実行画面
│   │   ├── app.results.$id.tsx   # 結果画面
│   │   └── app.settings.tsx      # 設定画面
│   ├── components/               # UIコンポーネント
│   │   ├── DataPreview.tsx
│   │   ├── ChannelConfig.tsx
│   │   ├── ContributionChart.tsx
│   │   ├── SaturationCurve.tsx
│   │   └── BudgetAllocation.tsx
│   ├── services/                 # バックエンドサービス
│   │   ├── shopify-data.server.ts
│   │   ├── excel-parser.server.ts
│   │   ├── data-merger.server.ts
│   │   └── analysis-runner.server.ts
│   └── lib/                      # ユーティリティ
│       ├── shopifyql.ts
│       └── validation.ts
├── engine/                       # MMM計算エンジン（Python）
│   ├── mmm_runner.py             # メインエントリーポイント
│   ├── models/
│   │   ├── lightweight_mmm.py
│   │   └── pymc_marketing.py
│   ├── preprocessing/
│   │   ├── data_validator.py
│   │   └── feature_engineering.py
│   ├── postprocessing/
│   │   ├── result_formatter.py
│   │   └── excel_generator.py
│   └── requirements.txt
├── prisma/
│   └── schema.prisma
├── docs/                         # ドキュメント
│   ├── requirements.md
│   ├── competitive-analysis.md
│   ├── shopify-api-spec.md
│   └── technical-design.md
├── package.json
├── shopify.app.toml
└── README.md
```

---

## 6. MMM実行フロー（非同期処理）

```
1. ユーザーが「分析を実行」をクリック
   ↓
2. Node.js バックエンド
   ├── 統合CSVを生成（Shopify + Excel データマージ）
   ├── Analysis レコードを作成（status: PENDING）
   └── BullMQ キューにジョブを投入
   ↓
3. Python ワーカー（BullMQ consumer）
   ├── CSVを読み込み
   ├── 前処理（欠損値補完、正規化）
   ├── MMMモデル実行（LightweightMMM / PyMC）
   ├── 結果をJSON化
   └── Analysis レコードを更新（status: COMPLETED, results: {...}）
   ↓
4. フロントエンド
   ├── ポーリングで status をチェック（3秒間隔）
   ├── COMPLETED → 結果ダッシュボードを表示
   └── FAILED → エラーメッセージを表示
```

---

## 7. Excelテンプレート連携

### 7.1 ダウンロード（テンプレート生成）

- `create_mmm_template.py`（mitsui-mmmリポジトリ）のロジックを流用
- Node.js側でexceljsを使って動的生成
- Shopify自動取得可能な列はグレーアウト（手動入力不要を明示）
- ショップの実際のデータ期間に合わせて日付をプリフィル

### 7.2 アップロード（バリデーション）

バリデーション項目:
1. ファイル形式チェック（.xlsx / .xls / .csv）
2. ヘッダー行の整合性チェック（テンプレートと一致するか）
3. 日付列の形式・範囲チェック
4. 数値列の型チェック（文字列混入検知）
5. 欠損率の計算（列ごと）
6. 異常値検知（IQR法）
7. Shopify自動取得データとの期間整合性チェック
```
