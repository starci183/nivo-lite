import { sql } from "@modules/platform/database"

/** The one durable identity admitted by the foreign-lease broker proof. */
export const FENCING_OUTBOX = sql`SELECT id, state, attempts FROM public.job_outbox WHERE dedupe_key = $1 LIMIT 1`
/** Claims belong to the isolated outbox identity, so cleanup cannot affect another proof. */
export const CLEAN_FENCING_JOB = sql`DELETE FROM public.jobs WHERE job_key = $1`
/** The proof leaves no durable queue admission after its relay has stopped. */
export const CLEAN_FENCING_OUTBOX = sql`DELETE FROM public.job_outbox WHERE id = $1`
