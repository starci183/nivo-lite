-- knowledge-chunk-place: forward-only; immutable once on origin/main. Expand step: two nullable columns, nothing is dropped or tightened, no row is rewritten, and the row-level security of the table is untouched.
-- A passage records where in its document it sits when the file says so: the page of a PDF, the slide of a presentation or the sheet of a workbook, so a quote can name its page. A passage stored before the columns has neither and shows no place.
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS place_kind text;
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS place_label text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'knowledge_chunks_place_check' AND conrelid = 'public.knowledge_chunks'::regclass
    ) THEN
        ALTER TABLE public.knowledge_chunks ADD CONSTRAINT knowledge_chunks_place_check
            CHECK (
                (place_kind IS NULL AND place_label IS NULL)
                OR (place_kind IN ('page', 'slide', 'sheet') AND place_label IS NOT NULL AND char_length(place_label) BETWEEN 1 AND 120)
            );
    END IF;
END
$$;
