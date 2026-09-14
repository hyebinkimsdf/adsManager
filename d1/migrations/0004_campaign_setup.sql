-- Apply once after 0003. New campaigns stay paused; no media delivery is started.
ALTER TABLE Campaign ADD COLUMN totalBudget INTEGER;
ALTER TABLE Campaign ADD COLUMN startDate TEXT;
ALTER TABLE Campaign ADD COLUMN endDate TEXT;
ALTER TABLE Campaign ADD COLUMN trackingConnectionId TEXT;
ALTER TABLE Campaign ADD COLUMN setupStatus TEXT CHECK (setupStatus IN ('draft', 'configured'));
ALTER TABLE Campaign ADD COLUMN createRequestId TEXT;
ALTER TABLE Campaign ADD COLUMN setupRequestHash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_setup_request ON Campaign(ownerId, createRequestId);

-- Only a trusted verification workflow may mark connected and verifiedAt.
-- A SiteScan or saved EventRule alone is NOT proof of a working connection.
CREATE TABLE IF NOT EXISTS TrackingConnection (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL,
  name TEXT NOT NULL,
  siteUrl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'revoked')),
  verifiedAt TEXT,
  revokedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_tracking_connection_owner ON TrackingConnection(ownerId, status);
