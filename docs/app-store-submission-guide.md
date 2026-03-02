# MMM Analytics — App Store Submission Guide

## Pre-requisites
- All assets are ready in `docs/assets/`
- App icon: `docs/assets/app-icon-512.png` (512x512)
- Screenshots: `docs/assets/screenshots/01-dashboard.png` ~ `06-data-setup.png`
- Listing text: `docs/app-store-listing.md`
- App deployed: mmm-analytics-5

---

## Step-by-Step Submission

### Step 1: Open Partners Dashboard
1. Go to https://partners.shopify.com
2. Login with `t.hamano@entech0410.com`
3. Navigate to **Apps** → **MMM Analytics**

### Step 2: App Setup (Configuration)
Navigate to **Configuration** tab:
- [x] App name: `MMM Analytics` (already set)
- [x] Access scopes: `read_orders` (already set)
- [x] Webhooks configured (already set)

### Step 3: Distribution
Navigate to **Distribution** tab:
1. Select **Shopify App Store** distribution
2. Click **Create listing**

### Step 4: App Listing
Navigate to **App listing** section:

#### Basic Info
| Field | Value |
|-------|-------|
| App name | `MMM Analytics` |
| Tagline | `Measure each marketing channel's true revenue contribution with MMM` |
| App icon | Upload `docs/assets/app-icon-512.png` |

#### Detailed Description
Copy from `docs/app-store-listing.md` → "Detailed Description" section:

```
Know exactly which marketing channels drive your revenue.

Stop guessing which ads work. MMM Analytics uses Marketing Mix Modeling — the same methodology used by Fortune 500 companies — to measure each channel's true contribution to your revenue.

How It Works

1. Connect your data — Sync Shopify sales automatically, then upload your ad spend data via our Excel template.
2. Run analysis — Our OLS regression engine processes your data to separate each channel's impact.
3. Get actionable insights — See channel contribution charts, ROAS by channel, and AI-powered budget optimization recommendations.

Key Features

Channel Contribution Analysis
See exactly how much revenue each marketing channel (Google Ads, Meta Ads, TikTok, LINE, etc.) drives — including the baseline revenue that comes without any advertising.

Saturation & Marginal ROI (Pro)
Understand which channels are oversaturated and where additional spend still has high returns. Find the sweet spot for each channel's budget.

Budget Optimization (Pro)
Get AI-powered recommendations on how to reallocate your existing budget for maximum revenue lift — without spending a single dollar more.

Excel Report Export (Starter+)
Download comprehensive Excel reports with channel breakdowns, ROAS analysis, and optimization recommendations to share with your team.

Model Accuracy Metrics
Every analysis includes R² and MAPE scores so you know how reliable the results are. No black boxes.

Plans

Free: Dashboard, data sync, 1 analysis/month
Starter ($19/mo): Unlimited analyses, Excel export, channel details
Pro ($49/mo): Budget optimization, saturation analysis, marginal ROI

All paid plans include a 7-day free trial. Cancel anytime.
```

#### Screenshots (upload in order)
1. `01-dashboard.png` — Dashboard overview with KPI cards and channel contribution
2. `02-plans.png` — Three-tier pricing page
3. `03-channel-contribution.png` — Channel contribution analysis with bar chart and detail table
4. `04-channel-detail.png` — Saturation & Marginal ROI analysis
5. `05-budget-optimization.png` — Budget optimization recommendations
6. `06-data-setup.png` — Data setup with Shopify sync and Excel upload

### Step 5: App URL & Support
| Field | Value |
|-------|-------|
| App URL | *(auto-set by Shopify)* |
| Privacy policy URL | `https://{APP_URL}/app/privacy` |
| Support email | `support@entech0410.com` |

### Step 6: Category & Keywords
| Field | Value |
|-------|-------|
| Category | **Analytics** |
| Keywords | `marketing mix modeling, MMM, ROAS, channel attribution, budget optimization, marketing analytics, ad spend analysis, revenue attribution, marketing ROI, channel contribution` |

### Step 7: Pricing
Set pricing in the **Pricing** section:
- Free plan: Available
- App charges: Managed via Shopify Billing API (already implemented)

### Step 8: Review & Submit
1. Review all fields
2. Click **Submit for review**
3. Shopify review typically takes 5-10 business days

---

## File Locations Summary
```
docs/assets/
├── app-icon-512.png          ← App icon (512x512)
└── screenshots/
    ├── 01-dashboard.png       ← Dashboard
    ├── 02-plans.png           ← Plans & Pricing
    ├── 03-channel-contribution.png  ← Channel Contribution
    ├── 04-channel-detail.png  ← Saturation & Marginal ROI
    ├── 05-budget-optimization.png   ← Budget Optimization
    └── 06-data-setup.png      ← Data Setup
```
