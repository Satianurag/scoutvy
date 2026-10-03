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
