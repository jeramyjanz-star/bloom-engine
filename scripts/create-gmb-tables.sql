-- =============================================================================
-- GMB Tables Migration
-- Run in Supabase SQL editor for bloom_engine schema
-- =============================================================================

-- GMB Post Log
-- Tracks every generated post from creation through approval and publishing.
-- status values: pending_approval | approved | posted | skipped | failed
CREATE TABLE IF NOT EXISTS bloom_engine.gmb_post_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    TEXT        REFERENCES bloom_engine.clients(id) ON DELETE CASCADE,
  post_type    TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending_approval',
  gmb_post_id  TEXT,
  approved_at  TIMESTAMPTZ,
  posted_at    TIMESTAMPTZ,
  views        INTEGER     DEFAULT 0,
  clicks       INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gmb_post_log_client_status
  ON bloom_engine.gmb_post_log(client_id, status);

CREATE INDEX IF NOT EXISTS gmb_post_log_created
  ON bloom_engine.gmb_post_log(created_at DESC);

-- GMB Metrics
-- Stores weekly aggregated performance data fetched from the GBP Insights API.
-- UNIQUE constraint on (client_id, week_start) enables upsert semantics.
CREATE TABLE IF NOT EXISTS bloom_engine.gmb_metrics (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         TEXT    REFERENCES bloom_engine.clients(id) ON DELETE CASCADE,
  week_start        DATE    NOT NULL,
  profile_views     INTEGER DEFAULT 0,
  website_clicks    INTEGER DEFAULT 0,
  direction_requests INTEGER DEFAULT 0,
  calls             INTEGER DEFAULT 0,
  photo_views       INTEGER DEFAULT 0,
  top_post_id       TEXT,
  top_post_views    INTEGER DEFAULT 0,
  ai_insight        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_start)
);

-- GMB Credentials
-- Stores OAuth refresh tokens so the posting engine can obtain access tokens
-- without requiring the user to re-authenticate each time.
CREATE TABLE IF NOT EXISTS bloom_engine.gmb_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT        REFERENCES bloom_engine.clients(id) ON DELETE CASCADE UNIQUE,
  refresh_token TEXT        NOT NULL,
  connected_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Row Level Security
-- Service role bypasses RLS; these policies restrict anon/authenticated access.
-- =============================================================================

ALTER TABLE bloom_engine.gmb_post_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_engine.gmb_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloom_engine.gmb_credentials ENABLE ROW LEVEL SECURITY;
