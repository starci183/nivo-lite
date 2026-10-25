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
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { InjectQueueFactory, InjectQueueOptions } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import {
    ATTEMPTS,
    BACKOFF_MS,
    KEEP_COMPLETED_SECONDS,
    TOUCHES_PER_TIMEOUT,
    backoffMsOf,
    deferMsOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    reasonOf,
    secondsOf,
    workspaceOf,
} from "./queue.policy"
import type {
    BullmqConnection,
    BullmqJob,
    BullmqQueue,
    BullmqWorker,
    QueueFactory,
    QueueTransport,
    QueueTransportState,
} from "./queue-transport.port"
import { JOB_DEAD, JOB_DONE, JOB_LEASE, JOB_RETRY, JOB_START } from "./persistence/queue.sql"
import type { QueueStartRow } from "./persistence/queue.rows"

/** A delivery in flight: the signal that aborts it and the promise that settles when it is done. */
interface Run {
    abort: AbortController
    done: Promise<void>
}

/** The durable states a broker job can be in, mapped from BullMQ's job states. */
const TRANSPORT_STATES: Readonly<Record<string, QueueTransportState>> = {
    wait: "waiting",
    waiting: "waiting",
    prioritized: "waiting",
    "waiting-children": "waiting",
    delayed: "delayed",
    active: "active",
    completed: "completed",
    failed: "failed",
}

@Injectable()
/**
 * The QueueTransport port over BullMQ on Redis: the relay publishes committed outbox rows as jobs keyed by their row id
 * and a worker per queue runs each job against the durable record — the per-workspace slot limit, the start count and
 * the reason of a failure stay in PostgreSQL, while the broker orders, retries and holds the deliveries.
 */
export class BullmqQueueTransportClient implements QueueTransport {
    private readonly queues = new Map<string, BullmqQueue>()
    private readonly workers: Array<BullmqWorker> = []
    private readonly runs = new Set<Run>()
    private closing = false

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueFactory() private readonly factory: QueueFactory,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        @Optional() @InjectErrorReporter() private readonly reporter?: ErrorReporter,
    ) {}

    /** Adds the job with the outbox row id as its BullMQ id, so adding it twice leaves one job. */
    async add(queue: string, job: string, jobId: string, payload: object): Promise<void> {
        await this.queueOf(queue).add(job, payload, {
            jobId,
            attempts: ATTEMPTS,
            backoff: { type: "exponential", delay: BACKOFF_MS },
            removeOnComplete: { age: KEEP_COMPLETED_SECONDS },
        })
    }

    /** The broker-side state of the job, or "missing" when the broker holds nothing under the id. */
    async stateOf(queue: string, jobId: string): Promise<QueueTransportState> {
        const job = await this.queueOf(queue).getJob(jobId)
        if (job === undefined) return "missing"
        return TRANSPORT_STATES[await job.getState()] ?? "unknown"
    }

    /** Drops the job the broker holds and adds it again under the same id, with a fresh retry budget. */
    async republish(queue: string, job: string, jobId: string, payload: object): Promise<void> {
        await this.queueOf(queue)
            .getJob(jobId)
            .then((held) => held?.remove())
        await this.add(queue, job, jobId, payload)
    }

    /** Starts a worker of the queue whose processor settles every delivery against the durable record. */
    work(handler: QueueHandler, concurrency: number): Promise<void> {
        this.workers.push(
            this.factory.worker(handler.queue, (job, token) => this.deliver(handler, job, token), {
                ...this.connection(),
                concurrency,
                lockDuration: this.options.visibilityTimeoutMs,
                backoffStrategy: (attemptsMade, error) => backoffMsOf(attemptsMade, error),
            }),
        )
        return Promise.resolve()
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Aborts the running deliveries after the shutdown grace, then closes the workers and the queues. */
    async close(): Promise<void> {
        this.closing = true
        let graceTimer: ReturnType<typeof setTimeout> | undefined
        try {
            await Promise.race([
                this.settled(),
                new Promise<void>((resolve) => {
                    graceTimer = setTimeout(() => {
                        Array.from(this.runs).forEach((run) => run.abort.abort(new Error("worker shutting down")))
                        resolve()
                    }, this.options.shutdownGraceMs)
                }),
            ])
        } finally {
            clearTimeout(graceTimer)
        }
        await this.settled()
        await Promise.all(this.workers.map((worker) => worker.close(true)))
        await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    }

    /** Resolves when every delivery in flight has settled. */
    private async settled(): Promise<void> {
        await Promise.allSettled(Array.from(this.runs).map((run) => run.done))
    }

    /** The Redis options every queue and worker of the app shares. */
    private connection(): BullmqConnection {
        return {
            prefix: this.options.prefix,
            connection: {
                host: this.options.redisHost,
                port: this.options.redisPort,
                db: this.options.redisDb,
                password: this.options.redisPassword?.reveal(),
                maxRetriesPerRequest: null,
            },
        }
    }

    /** The cached BullMQ queue of the name. */
    private queueOf(name: string): BullmqQueue {
        const known = this.queues.get(name)
        if (known !== undefined) return known
        const created = this.factory.queue(name, this.connection())
        this.queues.set(name, created)
        return created
    }

    /** Runs one broker job in the background; the worker sees the real outcome (the DelayedError moves the job to delayed). */
    private deliver(handler: QueueHandler, job: BullmqJob, token?: string): Promise<void> {
        const abort = new AbortController()
        const run: Run = { abort, done: Promise.resolve() }
        run.done = this.run(handler, job, abort.signal, token).finally(() => this.runs.delete(run))
        this.runs.add(run)
        return run.done
    }

    /**
     * Admits the job against the durable record (counting the real start and the workspace slot), runs the handler
     * while the slot is renewed, then closes the row done or settles the failure on it.
     */
    private async run(handler: QueueHandler, job: BullmqJob, signal: AbortSignal, token?: string): Promise<void> {
        const id = job.id
        if (id === undefined) {
            this.logger.warn(QueueLogEvent.SettleFailed, { queue: handler.queue, job: job.name })
            return
        }
        const [started] = await this.entityManager.query<Array<QueueStartRow>>(JOB_START, [
            handler.queue,
            id,
            this.options.workspaceConcurrency,
            secondsOf(this.options.visibilityTimeoutMs),
        ])
        if (started === undefined || started.outcome === "terminal" || started.outcome === "missing") return
        if (started.outcome === "busy") {
            await job.moveToDelayed(this.clock.now().getTime() + deferMsOf(id), token)
            return Promise.reject(new DelayedError())
        }
        const delivery = deliveryOf(handler.queue, job, started.attempt, signal)
        const heartbeat = setInterval(
            () => void this.touch(id, handler.queue),
            Math.ceil(this.options.visibilityTimeoutMs / TOUCHES_PER_TIMEOUT),
        )
        const failure = await handler.handle(delivery).then(
            () => null,
            (cause: unknown) => ({ cause }),
        )
        clearInterval(heartbeat)
        if (failure === null) {
            await this.entityManager.query(JOB_DONE, [id]).catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.SettleFailed, cause, { queue: handler.queue, jobId: id })
                throw cause
            })
            return
        }
        await this.settleFailure(handler, delivery, job, id, token, failure.cause).catch((cause: unknown) => {
            if (cause !== failure.cause && !(cause instanceof DelayedError) && !(cause instanceof UnrecoverableError)) {
                this.logger.error(QueueLogEvent.SettleFailed, cause, { queue: handler.queue, jobId: id })
            }
            throw cause
        })
    }

    /** Renews the workspace slot of a running delivery; a failure is logged and the next renewal tries again. */
    private touch(id: string, queue: string): Promise<void> {
        return this.entityManager.query(JOB_LEASE, [id, secondsOf(this.options.visibilityTimeoutMs)]).then(
            () => undefined,
            (cause: unknown) => {
                this.logger.error(QueueLogEvent.TouchFailed, cause, { queue, jobId: id })
            },
        )
    }

    /**
     * A failed delivery goes back at once on shutdown, is dead-lettered when it cannot or may not run again (the
     * failure hook runs once and the broker keeps the failed job), and otherwise retries after its pause.
     */
    private async settleFailure(
        handler: QueueHandler,
        delivery: QueueDelivery,
        job: BullmqJob,
        id: string,
        token: string | undefined,
        cause: unknown,
    ): Promise<void> {
        const fields = { queue: handler.queue, jobId: id, job: delivery.job, attempt: delivery.attempt }
        if (delivery.signal.aborted || this.closing) {
            this.logger.warn(QueueLogEvent.HandedBack, fields)
            await this.entityManager.query(JOB_RETRY, [id, "worker shutting down"])
            await job.moveToDelayed(this.clock.now().getTime() + deferMsOf(id), token)
            return Promise.reject(new DelayedError())
        }
        if (isUnrecoverable(cause) || isExhausted(delivery.attempt)) {
            this.logger.error(QueueLogEvent.DeadLettered, cause, fields)
            void this.reporter?.report(`job.${handler.queue}`, cause, {
                workspaceId: workspaceOf(delivery.payload),
                job: delivery.job,
                attempt: delivery.attempt,
            })
            await this.notifyFailed(handler, delivery, cause)
            await this.entityManager.query(JOB_DEAD, [id, reasonOf(cause)])
            return Promise.reject(new UnrecoverableError(reasonOf(cause)))
        }
        this.logger.error(QueueLogEvent.DeliveryFailed, cause, fields)
        await this.entityManager.query(JOB_RETRY, [id, reasonOf(cause)])
        return Promise.reject(cause)
    }

    /** Runs the failure hook of the handler once; a hook that throws is logged and does not keep the job from ending failed. */
    private async notifyFailed(handler: QueueHandler, delivery: QueueDelivery, cause: unknown): Promise<void> {
        if (handler.failed === undefined) return
        await handler.failed(delivery, cause).catch((error: unknown) => {
            this.logger.error(QueueLogEvent.FailureHookFailed, error, { queue: handler.queue, job: delivery.job })
        })
    }
}
