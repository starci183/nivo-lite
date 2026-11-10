/** What every key of the queue outbox holds, by the `job_outbox_dedupe_key_check` constraint: a `<scope>:<id>` shape. */
export const OUTBOX_KEY_SEPARATOR = ":"

/**
 * The outbox key of the delivery that hands a parked job back: `<jobKey>:r<n>`. A job's key is the id of the delivery that last ran it (a
 * bare uuid), so the separator is what makes it a valid outbox key; `n` counts the resumes, so each hand-back is a delivery of its own.
 */
export const resumeKeyOf = (jobKey: string, resumeCount: number): string =>
    `${jobKey}${OUTBOX_KEY_SEPARATOR}r${String(resumeCount)}`
