# BLOOM ENGINE — Database Setup

Run this ONE time in the Supabase SQL Editor:
https://supabase.com/dashboard/project/etzonmhbrmdiwblheesg/sql/new

Copy and paste the entire contents of `scripts/create-schema.sql` and click Run.

## Quick Link
1. Open: https://supabase.com/dashboard/project/etzonmhbrmdiwblheesg/sql/new
2. Paste: contents of `scripts/create-schema.sql`  
3. Click Run
4. Then seed FBOC: run `doppler run --project anchor-lumen --config prd -- npm run seed-db`

## What it creates
- `bloom_engine` schema
- 8 tables: clients, seo_audits, content, aeo_queries, reviews, review_requests, schema_registry, content_calendar
- Seeds FBOC as first client
