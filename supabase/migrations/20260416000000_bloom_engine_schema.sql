-- BLOOM ENGINE Database Schema
-- Run against: etzonmhbrmdiwblheesg.supabase.co
-- Schema: bloom_engine

CREATE SCHEMA IF NOT EXISTS bloom_engine;

-- Clients registry
CREATE TABLE IF NOT EXISTS bloom_engine.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- SEO audits per client
CREATE TABLE IF NOT EXISTS bloom_engine.seo_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  health_score INTEGER,
  pages_crawled INTEGER,
  critical_issues INTEGER,
  high_issues INTEGER,
  issues_json JSONB,
  fixes_generated BOOLEAN DEFAULT FALSE
);

-- Content (blog posts, GMB posts, social)
CREATE TABLE IF NOT EXISTS bloom_engine.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  content_type TEXT,
  title TEXT,
  slug TEXT,
  body TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AEO citation tracking
CREATE TABLE IF NOT EXISTS bloom_engine.aeo_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  query_text TEXT NOT NULL,
  last_tested TIMESTAMPTZ,
  cited_sources JSONB,
  client_cited BOOLEAN,
  competitor_cited TEXT,
  raw_response TEXT,
  UNIQUE(client_id, query_text)
);

-- GMB reviews
CREATE TABLE IF NOT EXISTS bloom_engine.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  gmb_review_id TEXT UNIQUE,
  author TEXT,
  rating INTEGER,
  body TEXT,
  responded BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  created_at TIMESTAMPTZ
);

-- Review requests sent
CREATE TABLE IF NOT EXISTS bloom_engine.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_opened BOOLEAN DEFAULT FALSE,
  link_clicked BOOLEAN DEFAULT FALSE,
  review_received BOOLEAN DEFAULT FALSE
);

-- Schema markup registry
CREATE TABLE IF NOT EXISTS bloom_engine.schema_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  schema_type TEXT,
  schema_json JSONB,
  installed BOOLEAN DEFAULT FALSE,
  last_validated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, schema_type)
);

-- Content calendar
CREATE TABLE IF NOT EXISTS bloom_engine.content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT REFERENCES bloom_engine.clients(id),
  week_start DATE,
  content_id UUID REFERENCES bloom_engine.content(id),
  channel TEXT,
  status TEXT DEFAULT 'pending'
);
