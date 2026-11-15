CREATE TABLE IF NOT EXISTS top_caster_shares (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
