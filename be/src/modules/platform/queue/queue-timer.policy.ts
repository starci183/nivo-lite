/** A process-local timer that owns no queue message or worker. */
export interface LocalTimer {
    /** Cancels future callbacks of this timer. */
    cancel(): void
}

/** The work a process-local timer invokes. */
export type LocalTimerCallback = () => void

/** Runs one callback after the duration without depending on the queue consumer. */
export const startLocalTimeout = (timeoutMs: number, callback: LocalTimerCallback): LocalTimer => {
    const timer = setTimeout(callback, timeoutMs)
    return { cancel: () => clearTimeout(timer) }
}

/** Runs callbacks on a process-local interval without holding the process open or using a queue worker. */
export const startLocalInterval = (intervalMs: number, callback: LocalTimerCallback): LocalTimer => {
    const timer = setInterval(() => callback(), intervalMs)
    timer.unref()
    return { cancel: () => clearInterval(timer) }
}
