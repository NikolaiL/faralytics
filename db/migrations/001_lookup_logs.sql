CREATE TABLE IF NOT EXISTS lookup_events (
  lookup_id UUID PRIMARY KEY,
  tool TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT NOT NULL,
  viewer_fid NUMERIC(20,0),
  viewer_ip INET,
  identity_source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS lookup_events_tool_time ON lookup_events (tool, created_at DESC);
CREATE INDEX IF NOT EXISTS lookup_events_user_time ON lookup_events (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS lookup_accounts (
  lookup_id UUID NOT NULL REFERENCES lookup_events(lookup_id) ON DELETE CASCADE,
  fid NUMERIC(20,0) NOT NULL,
  position SMALLINT NOT NULL,
  PRIMARY KEY (lookup_id, fid),
  UNIQUE (lookup_id, position)
);
CREATE INDEX IF NOT EXISTS lookup_accounts_fid ON lookup_accounts (fid, lookup_id);
CREATE OR REPLACE VIEW lookup_log AS
SELECT e.*, a.fid AS viewed_fid, a.position
FROM lookup_events e JOIN lookup_accounts a USING (lookup_id);
