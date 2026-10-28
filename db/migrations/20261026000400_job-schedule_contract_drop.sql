-- The back end no longer registers its ticks at boot (they are the cron jobs of 20261026000300_job-ticks.sql), so the definer function it used to
-- ask for that, public.job_schedule, goes.
DROP FUNCTION IF EXISTS public.job_schedule(text, text, text, text);
