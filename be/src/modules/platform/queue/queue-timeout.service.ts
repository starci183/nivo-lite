import { Injectable } from "@nestjs/common"
import type { CancelQueueTimeout, QueueTimeout, QueueTimeoutCallback } from "./queue-timeout.port"

@Injectable()
/** Owns the native timers used for bounded dependency probes. */
export class QueueTimeoutService implements QueueTimeout {
    /** Schedules one callback and lets its caller cancel the pending deadline. */
    schedule(callback: QueueTimeoutCallback, delayMs: number): CancelQueueTimeout {
        const timer = setTimeout(callback, delayMs)
        return () => clearTimeout(timer)
    }
}
