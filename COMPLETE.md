# BLOOM ENGINE — BUILD COMPLETE

## 🚀 Live URLs
- Dashboard: https://bloom-engine.vercel.app/dashboard
- Admin Password: `OkiUirTYaHMYBQe3ly7J7kJuZzQOXgDR`
- FBOC Client View: https://bloom-engine.vercel.app/dashboard/fboc
- GitHub: https://github.com/jeramyjanz-star/bloom-engine

## ⚠️ ONE-TIME SETUP REQUIRED: Run Database Schema

Before using the dashboard, run this SQL in Supabase:
https://supabase.com/dashboard/project/etzonmhbrmdiwblheesg/sql/new

Paste contents of: `scripts/create-schema.sql` → Click Run

Then seed FBOC:
```bash
doppler run --project anchor-lumen --config prd -- npm run seed-db
```

## 📊 FBOC Initial State
- Blog Posts Ready to Generate: 12 topics loaded
- Location Pages Ready: 7 cities (Irvine, Newport Beach, Costa Mesa, Laguna Beach, Huntington Beach, Anaheim, Orange)
- GMB Posts Ready: 30 (in clients/fboc/gmb/post-calendar.md)
- Q&A Blocks: 25 (generate from dashboard)
- AEO Queries Loaded: 10 (run Test All from dashboard)
- Schema Types: LocalBusiness, Service×6, FAQPage, BreadcrumbList, WebSite

## 🏗️ Modules Built
| # | Module | Status |
|---|--------|--------|
| 1 | Schema Engine (JSON-LD structured data) | ✅ |
| 2 | Perplexity AEO Citation Intelligence | ✅ |
| 3 | Claude Haiku Content Generation Engine | ✅ |
| 4 | Playwright SEO Audit Agent | ✅ |
| 5 | GMB Operations Kit (30 posts, review system, n8n workflow) | ✅ |
| 6 | add-client CLI (10 industry templates) | ✅ |
| 7 | Bloomberg Terminal Dashboard | ✅ |

## 🌸 Next Steps for FBOC (Jocelyn)
1. **Run database SQL** (see above) — takes 30 seconds
2. **Log into dashboard**: https://bloom-engine.vercel.app/dashboard
   Password: `OkiUirTYaHMYBQe3ly7J7kJuZzQOXgDR`
3. **Generate schemas**: Click "Generate Schemas" in Schema panel
4. **Install schema bundle**: Follow `/clients/fboc/schema/install-guide.md` in `frenchbloomsoc.com` codebase
5. **Set up Google Business Profile**: Follow `/clients/fboc/gmb/setup-guide.md`
6. **Add GMB review URL** to Doppler: `BLOOM_CLIENT_FBOC_GMB_URL`
7. **Run AEO Test All**: See where French Blooms OC ranks in AI answers
8. **Run SEO Audit**: Click "Run Audit" to get health score + critical fixes
9. **Publish first blog post**: Generate from Content Command Center

## 🏗️ Adding Next ANCHOR Business
```bash
doppler run --project anchor-lumen --config prd -- \
  npm run add-client -- --id=wren --name="WREN AI" --url=xwrenx.com --industry=saas --city="Houston, TX"
```

## 🔑 Credentials Summary
| Key | Value |
|-----|-------|
| Dashboard URL | https://bloom-engine.vercel.app/dashboard |
| Admin Password | `OkiUirTYaHMYBQe3ly7J7kJuZzQOXgDR` |
| Supabase Project | etzonmhbrmdiwblheesg |
| Doppler Project | anchor-lumen / prd |
| GitHub | jeramyjanz-star/bloom-engine |

## 📁 Key Files
```
bloom-engine/
├── clients/fboc/
│   ├── config.json              — FBOC client configuration
│   ├── gmb/
│   │   ├── setup-guide.md       — GBP creation walkthrough
│   │   ├── post-calendar.md     — 30 ready-to-paste GMB posts
│   │   └── review-system/       — Email sequences, SMS, n8n workflow
│   └── generated/               — Generated content saved here
├── src/lib/
│   ├── schema-engine.ts         — JSON-LD schema generator
│   ├── perplexity-engine.ts     — AEO citation tracker
│   ├── content-engine.ts        — Claude Haiku content generator
│   ├── audit-agent.ts           — Playwright SEO crawler
│   └── supabase.ts              — DB clients
├── scripts/
│   ├── create-schema.sql        — RUN THIS IN SUPABASE FIRST
│   ├── add-client.ts            — New business onboarding
│   ├── run-audit.ts             — CLI audit runner
│   └── generate-schema.ts       — CLI schema generator
└── app/dashboard/               — Bloomberg Terminal dashboard
```
