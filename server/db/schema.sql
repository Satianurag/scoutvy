CREATE TABLE IF NOT EXISTS siws_nonces (
  nonce TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS siws_nonces_expires_at_idx ON siws_nonces (expires_at);

CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES users (wallet_address) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_wallet_address_idx ON sessions (wallet_address);

CREATE TABLE IF NOT EXISTS sgt_claims (
  mint TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES users (wallet_address) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sgt_claims_wallet_address_idx ON sgt_claims (wallet_address);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS bounties (
  id UUID PRIMARY KEY,
  poster_wallet TEXT NOT NULL REFERENCES users (wallet_address) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_label TEXT NOT NULL,
  radius_m INTEGER NOT NULL,
  mint TEXT NOT NULL,
  amount NUMERIC(20, 0) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'cancelled', 'expired', 'paid', 'refunded')),
  bounty_address TEXT NOT NULL UNIQUE,
  create_signature TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bounties_poster_wallet_idx ON bounties (poster_wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS bounties_open_idx ON bounties (expires_at) WHERE status = 'open';

ALTER TABLE bounties ADD COLUMN IF NOT EXISTS close_signature TEXT UNIQUE;

ALTER TABLE bounties ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS scout_claims (
  bounty_id UUID PRIMARY KEY REFERENCES bounties (id),
  scout_wallet TEXT NOT NULL REFERENCES users (wallet_address),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  capture_token UUID,
  capture_started_at TIMESTAMPTZ,
  capture_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scout_claims_wallet_idx ON scout_claims (scout_wallet);

ALTER TABLE scout_claims ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS bounty_proofs (
  id UUID PRIMARY KEY,
  bounty_id UUID NOT NULL UNIQUE REFERENCES scout_claims (bounty_id),
  scout_wallet TEXT NOT NULL REFERENCES users (wallet_address),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'disputed', 'paid', 'refunded')),
  image BYTEA NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 1048576),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  image_sha256 TEXT NOT NULL CHECK (length(image_sha256) = 64),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 1600),
  reported_latitude DOUBLE PRECISION NOT NULL CHECK (reported_latitude BETWEEN -90 AND 90),
  reported_longitude DOUBLE PRECISION NOT NULL CHECK (reported_longitude BETWEEN -180 AND 180),
  reported_accuracy_m DOUBLE PRECISION NOT NULL CHECK (reported_accuracy_m > 0),
  reported_location_at TIMESTAMPTZ NOT NULL,
  reported_capture_at TIMESTAMPTZ NOT NULL,
  capture_started_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bounty_proofs DROP CONSTRAINT IF EXISTS bounty_proofs_status_check;

ALTER TABLE bounty_proofs ADD CONSTRAINT bounty_proofs_status_check
  CHECK (status IN ('pending_review', 'disputed', 'paid', 'refunded'));

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS attestation_signature TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMPTZ;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS decision_reason TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS decision_digest TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS reviewer_wallet TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS dispute_signature TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS resolution_reason TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS resolution_digest TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS settlement_signature TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS decision_action TEXT CHECK (decision_action IN ('approve', 'dispute', 'resolve'));

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS decision_prepared_at TIMESTAMPTZ;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS wallet_signature TEXT;

ALTER TABLE bounty_proofs ADD COLUMN IF NOT EXISTS wallet_action TEXT CHECK (wallet_action IN ('approve', 'dispute', 'resolve'));

ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_status_check;

ALTER TABLE bounties ADD CONSTRAINT bounties_status_check
  CHECK (status IN ('pending', 'open', 'cancelled', 'expired', 'paid', 'refunded'));

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

-- Preserve moderation decisions while removing a deleted account's identity.
ALTER TABLE bounty_reports ALTER COLUMN reporter_wallet DROP NOT NULL;

-- Financial records must survive account operations, including concurrent writes.
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
