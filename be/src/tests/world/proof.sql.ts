import { sql } from "@modules/platform/database"
export const CRON = sql`SELECT schedule, command FROM cron.job WHERE jobname = 'content-tick'`
export const LOCK_TICKS = sql`LOCK TABLE public.job_outbox IN ACCESS EXCLUSIVE MODE`
export const FIRE_TICK = sql`DO $proof$
DECLARE tick text;
BEGIN
    SELECT command INTO STRICT tick FROM cron.job WHERE jobname = 'content-tick';
    EXECUTE tick;
END $proof$`
