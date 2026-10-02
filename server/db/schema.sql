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
  poster_wallet TEXT NOT NULL REFERENCES users (wallet_address) ON DELETE CASCADE,
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
