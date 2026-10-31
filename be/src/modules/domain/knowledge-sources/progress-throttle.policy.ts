/** The least time between two writes of the progress of one source while a stage counts passages. */
export const PROGRESS_INTERVAL_MS = 1000

/**
 * Lets one write per source through in each interval. It remembers the instant of the last write it let through, so a burst of
 * counts becomes about one write a second; `release` forgets a source whose stage ended.
 */
export class ProgressThrottlePolicy {
    private readonly lastWrite = new Map<string, number>()

    /** True when a write of this source may go out at `nowMs`; it counts as the last write. */
    admits(sourceId: string, nowMs: number): boolean {
        const last = this.lastWrite.get(sourceId)
        if (last !== undefined && nowMs - last < PROGRESS_INTERVAL_MS) return false
        this.lastWrite.set(sourceId, nowMs)
        return true
    }

    /** Forgets a source: its next write goes out at once. */
    release(sourceId: string): void {
        this.lastWrite.delete(sourceId)
    }
}
