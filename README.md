# BLOOM ENGINE
> ANCHOR's multi-tenant SEO/AEO/GEO intelligence platform

Automated SEO auditing, AI Answer Engine Optimization, Generative Engine Optimization,
Google Business Profile management, and content generation — deployed per business in minutes.

## Clients
| ID | Business | Status |
|----|----------|--------|
| fboc | French Blooms OC | ✅ Active |

## Stack
- Next.js 14 App Router + TypeScript strict
- Supabase (PostgreSQL + pgvector)
- Perplexity API (citation intelligence)
- Claude Haiku (content generation)
- Playwright (SEO crawling)
- Vercel deployment

## Quick Start
```bash
git clone https://github.com/jeramyjanz-star/bloom-engine
cd bloom-engine
doppler run --project anchor-lumen --config prd -- npm run dev
```

## Adding a New Client
```bash
npm run add-client -- --id=wren --name="WREN AI" --url=xwrenx.com --industry=saas
```
