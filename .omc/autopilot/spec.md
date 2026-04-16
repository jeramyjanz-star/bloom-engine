# BLOOM ENGINE — Autopilot Spec

## Product
Multi-tenant SEO/AEO/GEO intelligence platform for ANCHOR businesses.
Client #1: French Blooms OC (fboc).

## Stack
- Next.js 14 App Router + TypeScript strict
- Supabase (etzonmhbrmdiwblheesg) — schema: bloom_engine
- Perplexity API sonar-pro (AEO citation testing)
- Claude Haiku claude-haiku-4-5 (content generation)
- Playwright (SEO audit crawling)
- Vercel deployment (bloom-engine.vercel.app)
- Doppler: anchor-lumen/prd

## Modules
1. Schema Engine — LocalBusiness, Service, FAQPage, BreadcrumbList, WebSite schemas
2. Perplexity AEO Intelligence — citation tracking per query
3. Content Generation Engine — blog, GMB posts, location pages, Q&A via Claude Haiku
4. SEO Audit Agent — Playwright crawler, scoring, fix generator
5. GMB Operations Kit — setup guide, post calendar, review system, n8n workflow
6. add-client CLI — new business onboarding in minutes
7. Dashboard — Bloomberg Terminal aesthetic, empire overview + per-client views

## Database (bloom_engine schema)
Tables: clients, seo_audits, content, aeo_queries, reviews, review_requests, schema_registry, content_calendar

## Auth
Single password: BLOOM_ADMIN_PASSWORD from Doppler
Middleware protecting /dashboard routes

## Status
- Phase 0: COMPLETE (spec defined)
- Phase 1: COMPLETE (plan defined)
- Phase 2: IN PROGRESS
