-- job-park-resume: forward-only; immutable once on origin/main.
-- A job a retry cannot fix is parked (status failed_awaiting_fix) with the class and reason of its failure, the build that ran it and the
-- queue to resume it on, raises one alert (alerted_at) and is handed back to its queue by ParkedJobResumerService (resume_count).
ALTER TABLE public.jobs ALTER COLUMN status TYPE character varying(32);
ALTER TABLE public.jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
    CHECK (status::text = ANY (ARRAY['running', 'failed', 'done', 'failed_awaiting_fix']::text[]));
ALTER TABLE public.jobs
    ADD COLUMN failure_class character varying(16),
    ADD COLUMN queue character varying(200),
    ADD COLUMN parked_build character varying(200),
    ADD COLUMN parked_at timestamp with time zone,
    ADD COLUMN alerted_at timestamp with time zone,
    ADD COLUMN resume_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_failure_class_check
    CHECK (failure_class IS NULL OR failure_class IN ('transient', 'input', 'code', 'config'));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_parked_check
    CHECK ((status = 'failed_awaiting_fix') = (parked_at IS NOT NULL));
CREATE INDEX jobs_parked_idx ON public.jobs (parked_at) WHERE status = 'failed_awaiting_fix';
