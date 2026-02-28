# Shopify MMM App

Marketing Mix Modeling (MMM) for Shopify merchants.

**Shopifyストアオーナーが、インストールから分析結果の確認まで30分以内で完了できる**MMM分析アプリ。

## What is MMM?

Marketing Mix Modeling（マーケティング・ミックス・モデリング）は、各広告チャネルが売上にどれだけ貢献しているかを統計的に分析する手法です。Cookieレス時代のアトリビューションとして注目されています。

## Features (MVP)

- Shopify売上/PV/セッションデータの自動取得（ShopifyQL）
- Excelテンプレートによる広告データの手動補完（楽天/Amazon/Yahoo対応）
- MMM分析の実行と結果ダッシュボード
- チャネル別貢献度・飽和曲線・予算配分提案
- 結果Excelダウンロード（講義テンプレート互換）
- 日本語ファーストUI

## Target Users

- 月商100万〜3億円のEC事業者
- Shopify + 楽天/Amazon/Yahooのマルチモール運営者
- 広告効果を定量的に把握したいマーケティング担当者

## Tech Stack

- **Frontend**: React Router + Polaris Web Components + App Bridge
- **Backend**: Node.js + Prisma + PostgreSQL
- **MMM Engine**: Python (LightweightMMM / PyMC-Marketing)
- **Infrastructure**: Railway / Render + Redis (BullMQ)

## Documentation

- [要件定義書](docs/requirements.md)
- [競合分析](docs/competitive-analysis.md)
- [Shopify APIデータ取得仕様](docs/shopify-api-spec.md)
- [技術設計](docs/technical-design.md)

## Project Status

**Phase**: 要件定義完了 → 技術設計に進行中

## License

Private - All rights reserved.
