import { Injectable, Optional } from "@nestjs/common"
import { DelayedError, UnrecoverableError } from "bullmq"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectErrorReporter } from "@modules/platform/errors"
import type { ErrorReporter } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { InjectQueueOptions } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import {
    TOUCHES_PER_TIMEOUT,
    deferMsOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    reasonOf,
    secondsOf,
    workspaceOf,
} from "./queue.policy"
import type { BullmqJob, QueueRedisGuard } from "./queue-transport.port"
import { JOB_DEAD, JOB_DONE, JOB_HANDBACK, JOB_LEASE, JOB_RETRY, JOB_START } from "./persistence/queue.sql"
import type { QueueStartRow } from "./persistence/queue.rows"

/** A delivery in flight: the signal that aborts it and the promise that settles when it is done. */
interface Run {
    abort: AbortController
    done: Promise<void>
}

@Injectable()
/**
 * Runs the broker jobs of the workers against the durable record: each delivery is admitted (the real start and the
 * workspace slot are counted in PostgreSQL), runs its handler while the slot is renewed, and is settled on the row it was
 * admitted under. The client also tracks the deliveries in flight so a shutdown can wait for them or abort them.
 */
export class BullmqQueueDeliveryClient {
    private readonly runs = new Set<Run>()
    private closing = false

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        @Optional() @InjectErrorReporter() private readonly reporter?: ErrorReporter,
    ) {}

    /** From now on every job a worker hands over is moved back to delayed before it is admitted. */
    stop(): void {
        this.closing = true
    }

    /** Signals every delivery in flight to stop; a handler that honours the signal hands its job back. */
    abortAll(): void {
        Array.from(this.runs).forEach((run) => run.abort.abort(new Error("worker shutting down")))
    }

    /** Resolves when every delivery in flight has settled, whatever its outcome. */
    async settled(): Promise<void> {
        await Promise.allSettled(Array.from(this.runs).map((run) => run.done))
    }

    /** Runs one broker job in the background; the worker sees the real outcome (the DelayedError moves the job to delayed). */
    deliver(handler: QueueHandler, job: BullmqJob, token: string | undefined, redis: QueueRedisGuard): Promise<void> {
        if (this.closing) return this.defer(job, token, deferMsOf(job.id ?? handler.queue), redis)
        const abort = new AbortController()
        const run: Run = { abort, done: Promise.resolve() }
        run.done = this.run(handler, job, abort.signal, token, redis).finally(() => this.runs.delete(run))
        this.runs.add(run)
        return run.done
    }

    /**
     * Admits the job against the durable record (counting the real start and the workspace slot), runs the handler
     * while the slot is renewed, then closes the row done or settles the failure on it.
     */
    private async run(
        handler: QueueHandler,
        job: BullmqJob,
        signal: AbortSignal,
        token: string | undefined,
        redis: QueueRedisGuard,
    ): Promise<void> {
        const id = job.id
        if (id === undefined) {
            this.logger.warn(QueueLogEvent.SettleFailed, { queue: handler.queue, job: job.name })
            return Promise.reject(new UnrecoverableError(QueueErrorCode.Unrecoverable))
        }
        await redis.command(redis.ready(handler.queue))
        const [started] = await this.entityManager.query<Array<QueueStartRow>>(JOB_START, [
            handler.queue,
            id,
            this.options.workspaceConcurrency,
            secondsOf(this.options.visibilityTimeoutMs),
        ])
        if (started === undefined || started.outcome === "missing") {
            return Promise.reject(new UnrecoverableError(QueueErrorCode.Unrecoverable))
        }
        if (started.outcome === "terminal") {
            return started.state === "failed"
                ? Promise.reject(new UnrecoverableError(QueueErrorCode.Unrecoverable))
                : undefined
        }
        if (started.outcome !== "started") return this.defer(job, token, deferMsOf(id), redis)
        const delivery = deliveryOf(handler.queue, job, started.attempt, signal)
        const failure = await this.handled(handler, delivery, started.run_token)
        if (failure === null) return this.complete(handler.queue, id, started.run_token)
        return this.settleFailure(handler, delivery, job, token, started.run_token, failure.cause, redis).catch(
            (cause: unknown) => {
                if (
                    cause !== failure.cause &&
                    !(cause instanceof DelayedError) &&
                    !(cause instanceof UnrecoverableError)
                ) {
                    this.logger.error(QueueLogEvent.SettleFailed, cause, { queue: handler.queue, jobId: id })
                }
                return Promise.reject(cause)
            },
        )
    }

    /** Runs the handler while the slot is renewed; the heartbeat ends whether the handler throws or rejects. */
    private handled(
        handler: QueueHandler,
        delivery: QueueDelivery,
        runToken: string,
    ): Promise<{ cause: unknown } | null> {
        const heartbeat = setInterval(
            () => void this.touch(delivery.id, handler.queue, runToken),
            Math.ceil(this.options.visibilityTimeoutMs / TOUCHES_PER_TIMEOUT),
        )
        return Promise.resolve()
            .then(() => handler.handle(delivery))
            .then(
                () => null,
                (cause: unknown) => ({ cause }),
            )
            .finally(() => clearInterval(heartbeat))
    }

    /** Closes the row done under the admission token; a persistence failure is logged and fails the delivery. */
    private complete(queue: string, id: string, runToken: string): Promise<void> {
        return this.entityManager.query(JOB_DONE, [id, runToken]).then(
            () => undefined,
            (cause: unknown) => {
                this.logger.error(QueueLogEvent.SettleFailed, cause, { queue, jobId: id })
                return Promise.reject(cause)
            },
        )
    }

    /** Renews the workspace slot of a running delivery; a failure is logged and the next renewal tries again. */
    private touch(id: string, queue: string, runToken: string): Promise<void> {
        return this.entityManager.query(JOB_LEASE, [id, secondsOf(this.options.visibilityTimeoutMs), runToken]).then(
            () => undefined,
            (cause: unknown) => {
                this.logger.error(QueueLogEvent.TouchFailed, cause, { queue, jobId: id })
            },
        )
    }

    /**
     * A delivery interrupted by the shutdown signal goes back at once without spending an attempt, a fenced claim that
     * is still live waits for its lease, a delivery that cannot or may not run again is dead-lettered (the failure hook
     * runs once and the broker keeps the failed job), and any other failure retries after its pause.
     */
    private async settleFailure(
        handler: QueueHandler,
        delivery: QueueDelivery,
        job: BullmqJob,
        token: string | undefined,
        runToken: string,
        cause: unknown,
        redis: QueueRedisGuard,
    ): Promise<void> {
        const fields = { queue: handler.queue, jobId: delivery.id, job: delivery.job, attempt: delivery.attempt }
        if (delivery.signal.aborted) {
            this.logger.warn(QueueLogEvent.HandedBack, fields)
            await this.entityManager.query(JOB_HANDBACK, [delivery.id, runToken])
            return this.defer(job, token, deferMsOf(delivery.id), redis)
        }
        if (cause instanceof QueueError && cause.code === QueueErrorCode.DeferredUntil) {
            await this.entityManager.query(JOB_HANDBACK, [delivery.id, runToken])
            return this.defer(job, token, Number(cause.params.seconds) * 1000, redis)
        }
        if (isUnrecoverable(cause) || isExhausted(delivery.attempt)) {
            this.logger.error(QueueLogEvent.DeadLettered, cause, fields)
            void this.reporter?.report(`job.${handler.queue}`, cause, {
                workspaceId: workspaceOf(delivery.payload),
                job: delivery.job,
                attempt: delivery.attempt,
            })
            await this.notifyFailed(handler, delivery, cause)
            await this.entityManager.query(JOB_DEAD, [delivery.id, reasonOf(cause), runToken])
            return Promise.reject(new UnrecoverableError(reasonOf(cause)))
        }
        this.logger.error(QueueLogEvent.DeliveryFailed, cause, fields)
        await this.entityManager.query(JOB_RETRY, [delivery.id, reasonOf(cause), runToken])
        return Promise.reject(cause)
    }

    /** Moves a delivery back without spending a broker attempt. */
    private async defer(job: BullmqJob, token: string | undefined, ms: number, redis: QueueRedisGuard): Promise<void> {
        await redis.command(job.moveToDelayed(this.clock.now().getTime() + ms, token))
        return Promise.reject(new DelayedError())
    }

    /** Runs the failure hook of the handler once; a hook that throws is logged and does not keep the job from ending failed. */
    private async notifyFailed(handler: QueueHandler, delivery: QueueDelivery, cause: unknown): Promise<void> {
        if (handler.failed === undefined) return
        try {
            await handler.failed(delivery, cause)
        } catch (error) {
            this.logger.error(QueueLogEvent.FailureHookFailed, error, { queue: handler.queue, job: delivery.job })
        }
    }
}
