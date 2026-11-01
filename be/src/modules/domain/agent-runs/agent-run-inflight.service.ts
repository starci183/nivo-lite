import { Injectable } from "@nestjs/common"
import type { BeforeApplicationShutdown } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { SHUTDOWN_WAIT_MS } from "./policies/agent-runs.policy"
import type { StepView } from "./agent-runs.contracts"

/** A step this process is running, and the work that runs it. */
interface Running {
    /** The step as claimed, with its fence. */
    readonly step: StepView
    /** Settles when the step's try ends, either way. */
    readonly done: Promise<unknown>
}

const never = (): void => undefined

@Injectable()
/**
 * Knows which steps this process is running. On shutdown it stops new claims, waits a bounded time for the running steps, and gives the claim
 * of every step still running back, so the sweep or the next boot takes it at once instead of after its deadline (the same stop-then-settle
 * order as the event consumer). A hard kill gives nothing back; the sweep takes the step when its claim runs out.
 */
export class AgentRunInflightService implements BeforeApplicationShutdown {
    private stopped = false

    private readonly running = new Map<string, Running>()

    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
        private readonly ledger: AgentStepLedgerService,
    ) {}

    /** True once shutdown began: no step is claimed any more. */
    get closed(): boolean {
        return this.stopped
    }

    /** Runs a claimed step's try and remembers it until it ends. */
    async track<T>(step: StepView, work: () => Promise<T>): Promise<T> {
        const key = `${step.runId}:${step.stepKey}`
        const done = work()
        this.running.set(key, { step, done })
        try {
            return await done
        } finally {
            this.running.delete(key)
        }
    }

    /** Stops new claims, waits a bounded time for the running steps and releases the claim of those still running. */
    async beforeApplicationShutdown(): Promise<void> {
        this.stopped = true
        await this.settle(SHUTDOWN_WAIT_MS)
        await eachInOrder([...this.running.values()], async ({ step }) => {
            try {
                await this.ledger.release(step)
            } catch (cause) {
                this.logger.error(AgentRunsLogEvent.ReleaseFailed, cause, { runId: step.runId, stepKey: step.stepKey })
            }
        })
    }

    private async settle(ms: number): Promise<void> {
        const ended = Promise.all([...this.running.values()].map(({ done }) => done.then(never, never))).then(never)
        let cancel = never
        const expired = new Promise<void>((resolve) => {
            cancel = this.timer.schedule(resolve, ms)
        })
        await Promise.race([ended, expired])
        cancel()
    }
}
