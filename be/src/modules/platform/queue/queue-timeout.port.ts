/** The callback a process-local deadline runs once. */
export type QueueTimeoutCallback = () => void

/** Cancels a pending process-local deadline. */
export type CancelQueueTimeout = () => void

/** A cancellable process-local deadline, independent of queue consumers. */
export interface QueueTimeout {
    /** Runs the callback once after the delay and returns its cancellation function. */
    schedule(callback: QueueTimeoutCallback, delayMs: number): CancelQueueTimeout
}
