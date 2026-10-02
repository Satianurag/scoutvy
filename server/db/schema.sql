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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'cancelled', 'expired')),
  bounty_address TEXT NOT NULL UNIQUE,
  create_signature TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bounties_poster_wallet_idx ON bounties (poster_wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS bounties_open_idx ON bounties (expires_at) WHERE status = 'open';

ALTER TABLE bounties ADD COLUMN IF NOT EXISTS close_signature TEXT UNIQUE;

ALTER TABLE bounties ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
