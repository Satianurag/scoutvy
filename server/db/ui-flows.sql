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

-- Moderation affects discovery, never escrow settlement or participant access.
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS moderation_decisions (
 id UUID PRIMARY KEY,
 report_id UUID NOT NULL REFERENCES bounty_reports(id),
 bounty_id UUID NOT NULL REFERENCES bounties(id),
 action TEXT NOT NULL CHECK(action IN ('dismiss','hide','restore')),
 note TEXT NOT NULL CHECK(length(note) BETWEEN 10 AND 1000),
 actor TEXT NOT NULL DEFAULT current_user,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_decisions_bounty_idx ON moderation_decisions(bounty_id,created_at DESC);

ALTER TABLE bounty_reports ALTER COLUMN reporter_wallet DROP NOT NULL;

-- Account/financial-record lifetimes are managed in account-deletion.sql.

-- Existing bounties and proofs retain their original on-site photo behavior.
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS task_mode TEXT NOT NULL DEFAULT 'on_site';
ALTER TABLE bounties ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE bounties ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE bounties ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE bounties ALTER COLUMN location_label DROP NOT NULL;
ALTER TABLE bounties ALTER COLUMN radius_m DROP NOT NULL;
ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_task_evidence_check;
ALTER TABLE bounties ADD CONSTRAINT bounties_task_evidence_check CHECK (
 (task_mode = 'remote' AND proof_type = 'written' AND latitude IS NULL AND longitude IS NULL AND location_label IS NULL AND radius_m IS NULL)
 OR (task_mode = 'on_site' AND proof_type IN ('photo','written') AND latitude IS NOT NULL AND longitude IS NOT NULL AND location_label IS NOT NULL AND radius_m IS NOT NULL)
);
ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS written_text TEXT;
ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS evidence_sha256 TEXT;
ALTER TABLE bounty_proofs ALTER COLUMN image DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN image_sha256 DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN width DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN height DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN reported_latitude DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN reported_longitude DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN reported_accuracy_m DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN reported_location_at DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN reported_capture_at DROP NOT NULL;
ALTER TABLE bounty_proofs ALTER COLUMN capture_started_at DROP NOT NULL;
ALTER TABLE bounty_proofs DROP CONSTRAINT IF EXISTS bounty_proofs_evidence_check;
ALTER TABLE bounty_proofs ADD CONSTRAINT bounty_proofs_evidence_check CHECK (
 (proof_type = 'photo' AND image IS NOT NULL AND image_sha256 IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL
 AND reported_latitude IS NOT NULL AND reported_longitude IS NOT NULL AND reported_accuracy_m IS NOT NULL
 AND reported_location_at IS NOT NULL AND reported_capture_at IS NOT NULL AND capture_started_at IS NOT NULL AND written_text IS NULL)
 OR (proof_type = 'written' AND char_length(written_text) BETWEEN 10 AND 5000 AND written_text IS NOT NULL
 AND evidence_sha256 IS NOT NULL AND length(evidence_sha256) = 64 AND image IS NULL AND image_sha256 IS NULL
 AND width IS NULL AND height IS NULL AND reported_latitude IS NULL AND reported_longitude IS NULL
 AND reported_accuracy_m IS NULL AND reported_location_at IS NULL AND reported_capture_at IS NULL AND capture_started_at IS NULL)
);
