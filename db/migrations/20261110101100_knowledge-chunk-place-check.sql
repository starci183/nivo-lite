-- A place is absent as a pair, or has both a kind and a label. The earlier place check keeps the allowed kinds and label lengths.
-- Its kind comparison can evaluate to NULL when only a label is present, which a CHECK accepts. These presence tests are always boolean.
-- Keep the committed check and its history unchanged. Validation deliberately refuses any existing partial pair instead of rewriting it.
ALTER TABLE public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_place_pair_check
    CHECK (
        (place_kind IS NULL AND place_label IS NULL)
        OR (place_kind IS NOT NULL AND place_label IS NOT NULL)
    );
