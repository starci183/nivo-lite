import { Injectable } from "@nestjs/common"

@Injectable()
/** Waits on the platform's abort-timeout signal: the one place this capability sleeps, so a spec can replace it. */
export class PauseClient {
    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => {
            AbortSignal.timeout(ms).addEventListener("abort", () => resolve(), { once: true })
        })
    }
}
