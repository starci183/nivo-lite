-- knowledge-source-reading: expand only; forward-only; immutable once on origin/main.
-- How the last reading of a document went, for the second-brain page: which reader read it (pdf, docx, xlsx, image, ...), how many
-- pages or sheets it has, whether any text was transcribed from a picture, the parts it could not read whole ("trang 3 không đọc
-- được") and, for a refused file, the plain reason the owner is shown. Written by the index job on every read of a file or link;
-- NULL for a document read before this column existed, for a note or a Q&A list, and for a file whose text the job knew unchanged.
-- The shape is the app's `SourceReading` (domain/knowledge-sources/knowledge-sources.contracts.ts); the CHECK keeps it an object and
-- small, so a reading never grows the row past what the page needs. Apply BEFORE the dist that carries this code: TypeORM names every
-- entity column in an insert, so an unmigrated database would refuse every new document.

ALTER TABLE public.knowledge_sources ADD COLUMN reading jsonb;
ALTER TABLE public.knowledge_sources ADD CONSTRAINT knowledge_sources_reading_check
    CHECK (reading IS NULL OR (jsonb_typeof(reading) = 'object' AND pg_column_size(reading) <= 16384));
