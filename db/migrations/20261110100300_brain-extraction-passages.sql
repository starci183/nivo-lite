-- brain-extraction-passages: forward-only; immutable once on origin/main. Expand step: two columns with defaults, nothing is dropped or tightened.
-- A reading records the hashes of the passages it finished, so an edited document is read for its changed passages only; a row with no hashes is read whole, as before. It also records that the facts changed before a retry, so the dossier review is requested once the reading ends.
ALTER TABLE public.brain_extractions ADD COLUMN IF NOT EXISTS passage_hashes text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.brain_extractions ADD COLUMN IF NOT EXISTS facts_changed boolean NOT NULL DEFAULT false;
