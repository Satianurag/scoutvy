CREATE TABLE IF NOT EXISTS account_data_requests (
 id UUID PRIMARY KEY,
 wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','cancelled','completed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS account_data_requests_pending_idx ON account_data_requests(wallet_address) WHERE status='pending';
CREATE TABLE IF NOT EXISTS blocked_users (
 id UUID PRIMARY KEY,
 wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
 blocked_wallet TEXT NOT NULL REFERENCES users(wallet_address),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(wallet_address,blocked_wallet),
 CHECK(wallet_address<>blocked_wallet)
);
CREATE TABLE IF NOT EXISTS bounty_reports (
 id UUID PRIMARY KEY,
 reporter_wallet TEXT NOT NULL REFERENCES users(wallet_address),
 bounty_id UUID NOT NULL REFERENCES bounties(id),
 reason TEXT NOT NULL CHECK(reason IN ('unsafe','privacy','misleading','spam','other')),
 details TEXT NOT NULL CHECK(length(details)<=1000),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(reporter_wallet,bounty_id)
);
CREATE TABLE IF NOT EXISTS push_devices (
 token TEXT PRIMARY KEY,
 wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
 reviews BOOLEAN NOT NULL DEFAULT true,
 rewards BOOLEAN NOT NULL DEFAULT true,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_devices_wallet_idx ON push_devices(wallet_address);
CREATE TABLE IF NOT EXISTS push_outbox (
 id UUID PRIMARY KEY,
 token TEXT NOT NULL REFERENCES push_devices(token) ON DELETE CASCADE,
 event_key TEXT NOT NULL,
 message JSONB NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ticket_id TEXT,
 sent_at TIMESTAMPTZ,
 receipt_checked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(token,event_key)
);
CREATE INDEX IF NOT EXISTS push_outbox_pending_idx ON push_outbox(next_attempt_at) WHERE sent_at IS NULL;

ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS session_hash TEXT REFERENCES sessions(token_hash) ON DELETE CASCADE;
