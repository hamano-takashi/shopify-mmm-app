# Shopify API データ取得仕様

> MMM分析に必要なデータのShopify API取得可否と実装方法

---

## 1. 目的変数（dep_var）

### 1.1 日次売上・注文数（ShopifyQL）

```graphql
{
  shopifyqlQuery(query: """
    FROM sales
    SHOW net_sales, gross_sales, orders, units_sold,
         new_customers, returning_customers, discounts
    GROUP BY day
    SINCE -180d
  """) {
    __typename
    ... on TableResponse {
      tableData {
        rowData
        columns { name dataType }
      }
    }
  }
}
```

**必要スコープ**: `read_reports`

### 1.2 注文詳細（Orders API）

```graphql
{
  orders(first: 50, query: "created_at:>2025-01-01") {
    edges {
      node {
        id
        createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        discountApplications(first: 5) {
          edges { node { ... on DiscountCodeApplication { code } value { ... on MoneyV2 { amount } } } }
        }
        customer { id }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**必要スコープ**: `read_orders`（60日以内）、`read_all_orders`（60日超、要申請）

---

## 2. コンテキスト変数（context_var）

### 2.1 PV・セッション・トラフィック（ShopifyQL）

```graphql
{
  shopifyqlQuery(query: """
    FROM sessions
    SHOW sessions, pageviews, online_store_visitors,
         add_to_carts, checkouts
    GROUP BY day
    SINCE -180d
  """) {
    __typename
    ... on TableResponse {
      tableData { rowData columns { name dataType } }
    }
  }
}
```

### 2.2 トラフィックソース別セッション

```graphql
{
  shopifyqlQuery(query: """
    FROM sessions
    SHOW sessions
    GROUP BY day, referrer_source
    SINCE -180d
  """) {
    __typename
    ... on TableResponse {
      tableData { rowData columns { name dataType } }
    }
  }
}
```

### 2.3 UTMパラメータ別セッション

```graphql
{
  shopifyqlQuery(query: """
    FROM sessions
    SHOW sessions
    GROUP BY day, utm_source, utm_medium
    SINCE -180d
  """) {
    __typename
    ... on TableResponse {
      tableData { rowData columns { name dataType } }
    }
  }
}
```

---

## 3. メディア変数（media_var / spend_var）

### 3.1 MarketingEngagement（条件付き取得）

MarketingEngagement はマーケティングアプリ（Google & YouTube、Meta等）が書き戻すデータ。

| フィールド | 型 | 説明 |
|---|---|---|
| `adSpend` | MoneyV2 | 当日の広告費用 |
| `impressionsCount` | Int | インプレッション数 |
| `clicksCount` | Int | クリック数 |
| `sales` | MoneyV2 | マーケティング経由の売上 |
| `orders` | Decimal | 注文数 |

**重要な制約**:
- データはアプリの書き戻し品質に依存（精度保証なし）
- 同期ラグ（最大24時間）がある
- 日本ローカルプラットフォーム（楽天/Amazon JP/Yahoo/LINE）は対応アプリがほぼない
- **結論: MMM用データソースとしては信頼性が低い → 各APIの直接取得を推奨**

### 3.2 プラットフォーム別対応状況

| プラットフォーム | Shopify経由 | 推奨取得方法 |
|---|---|---|
| Google Ads | 条件付き可 | Google Ads API 直接取得（v2で実装） |
| Meta Ads | 条件付き可 | Meta Marketing API 直接取得（v2で実装） |
| TikTok Ads | 条件付き可 | TikTok Marketing API（将来） |
| 楽天RPP | **不可** | Excelアップロード（RMS管理画面CSVエクスポート） |
| Amazon SP | **不可** | Excelアップロード（セラーセントラルCSVエクスポート） |
| Yahoo広告 | **不可** | Excelアップロード（管理画面CSVエクスポート） |
| LINE広告 | **不可** | Excelアップロード（管理画面CSVエクスポート） |

---

## 4. 取得不可能なデータ（Excel補完必須）

| データ項目 | 理由 | 補完方法 |
|---|---|---|
| 楽天RPP 広告費/IMP/Click | 楽天はShopify非連携 | Excelテンプレートアップロード |
| Amazon SP 広告費/IMP/Click | Amazon独立プラットフォーム | Excelテンプレートアップロード |
| Yahoo広告 費用/IMP/Click | 連携アプリの信頼性不明 | Excelテンプレートアップロード |
| LINE広告 費用/IMP/Click | Shopify連携なし | Excelテンプレートアップロード |
| モールイベント/セール日 | 外部カレンダー情報 | Excelテンプレートアップロード |
| CFキャンペーン期間 | 外部プラットフォーム情報 | Excelテンプレートアップロード |
| PR配信期間 | 社内情報 | Excelテンプレートアップロード |
| 天候データ（気温/降水量/積雪量） | Shopify外データ | 外部API（気象庁）or Excelアップロード |
| 商材価格指数 | Shopify外データ | Excelテンプレートアップロード |
| LINE友だち数推移 | LINE Official Account管理画面 | Excelテンプレートアップロード |
| レビュー数・評価推移 | ネイティブAPI無し | レビューアプリAPI or Excelアップロード |
| 在庫切れ履歴（過去分） | 現時点スナップショットのみ | 日次バッチで記録する仕組みが必要 |

---

## 5. ShopifyQL 利用可能メトリクス一覧

### sales テーブル

```
net_sales, gross_sales, orders, units_sold, customers,
new_customers, returning_customers, discounts, taxes,
shipping, returns, revenue
```

### sessions テーブル

```
sessions, pageviews, online_store_visitors, add_to_carts,
checkouts, sessions_with_cart_additions
```

### 利用可能ディメンション

```
【時間系】 day, week, month, quarter, year, hour_of_day, day_of_week
【商品系】 product_title, product_type, product_vendor, product_id
【地域系】 billing_country, billing_region, shipping_country
【チャネル系】 sales_channel, referrer_source, referrer_name,
              utm_source, utm_medium, utm_campaign
```

---

## 6. レート制限

- ShopifyQL: 複雑さベースのレート制限（クエリ内のメトリクス数・ディメンション数に依存）
- 429エラー時: 60秒待機が必要
- Orders API: 標準のGraphQLコスト制限（1000ポイント/秒）
