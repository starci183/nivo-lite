/** Asks the job fence before a batch: it rejects when this worker no longer holds the job, so no further batch runs. */
export type SweepFence = () => Promise<void>

/** The retention of the replay table: what the fenced sweep job calls. */
export interface RealtimeRetention {
    /**
     * Deletes frames older than the replay window, one bounded batch at a time, until a batch comes back short or the pass budget is
     * spent, and answers how many it deleted. `beforeBatch` runs before every batch, so the job fence is checked for each one.
     */
    sweep(beforeBatch: SweepFence): Promise<number>
}
