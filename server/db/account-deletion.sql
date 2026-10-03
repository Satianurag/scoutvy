-- Accounts and shared financial records have independent lifetimes. Wallet
-- addresses remain settlement identifiers, not live account foreign keys.
ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_poster_wallet_fkey;
ALTER TABLE scout_claims DROP CONSTRAINT IF EXISTS scout_claims_scout_wallet_fkey;
ALTER TABLE bounty_proofs DROP CONSTRAINT IF EXISTS bounty_proofs_scout_wallet_fkey;

CREATE OR REPLACE FUNCTION scoutvy_require_account() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE owner_wallet text;
BEGIN
  owner_wallet := to_jsonb(NEW)->>TG_ARGV[0];
  PERFORM 1 FROM users WHERE wallet_address=owner_wallet FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account no longer exists' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bounty_account_guard ON bounties;
CREATE TRIGGER bounty_account_guard BEFORE INSERT OR UPDATE OF poster_wallet ON bounties
FOR EACH ROW EXECUTE FUNCTION scoutvy_require_account('poster_wallet');
DROP TRIGGER IF EXISTS claim_account_guard ON scout_claims;
CREATE TRIGGER claim_account_guard BEFORE INSERT OR UPDATE OF scout_wallet,expires_at ON scout_claims
FOR EACH ROW EXECUTE FUNCTION scoutvy_require_account('scout_wallet');
DROP TRIGGER IF EXISTS proof_account_guard ON bounty_proofs;
CREATE TRIGGER proof_account_guard BEFORE INSERT OR UPDATE OF scout_wallet ON bounty_proofs
FOR EACH ROW EXECUTE FUNCTION scoutvy_require_account('scout_wallet');

-- A volatile function uses a fresh snapshot after waiting for the account lock.
-- All account writes either finish before deletion or fail against the removed
-- account. Settlement updates never require an active profile.
CREATE OR REPLACE FUNCTION scoutvy_delete_account(owner_wallet text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
BEGIN
  PERFORM 1 FROM users WHERE wallet_address=owner_wallet FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  UPDATE bounty_reports SET reporter_wallet=NULL,details='' WHERE reporter_wallet=owner_wallet;
  DELETE FROM blocked_users WHERE wallet_address=owner_wallet OR blocked_wallet=owner_wallet;
  DELETE FROM account_data_requests WHERE wallet_address=owner_wallet;
  DELETE FROM push_devices WHERE wallet_address=owner_wallet;
  DELETE FROM users WHERE wallet_address=owner_wallet;
  RETURN true;
END;
$$;
