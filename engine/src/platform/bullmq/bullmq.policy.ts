/** How many deliveries BullMQ gives a job before it keeps it as failed. */
export const ATTEMPTS = 4;

/** The pause after the first failed delivery; BullMQ doubles it with every further failure (5 s, 10 s, 20 s). */
export const BACKOFF_MS = 5_000;

/** Completed jobs are kept this long (seconds) so a repeated relay of the same row finds the id and adds nothing; and at most this many. */
export const KEEP_COMPLETED = { age: 24 * 3600, count: 5_000 } as const;

/** Failed jobs are kept a week for operators (docs/JOBS.md "Operations"). */
export const KEEP_FAILED = { age: 7 * 24 * 3600 } as const;

/** A workspace slot a crashed worker never released frees itself after this long; a running job renews it every third of it. */
export const WORKSPACE_SLOT_LEASE_MS = 90_000;

/** A job whose workspace has no free slot goes back to delayed for about this long (jittered) instead of holding a worker slot. */
export const WORKSPACE_BUSY_DELAY_MS = 3_000;

/** BullMQ's lock on an active job: renewed automatically by the worker; a stalled job is re-delivered after it expires. */
export const LOCK_DURATION_MS = 60_000;
