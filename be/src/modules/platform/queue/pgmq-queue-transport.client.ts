import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QueueDelivery, QueueHandler, QueueJob, QueueSchedulerDefinition } from "./queue.contracts"
import { InjectQueueOptions } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import {
    TOUCHES_PER_TIMEOUT,
    backoffSecondsOf,
    cronScheduleOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    reasonOf,
    retryAfterSecondsOf,
    secondsOf,
    tickOf,
} from "./queue.policy"
import type { QueueTransport } from "./queue-transport.port"
import {
    CRON_SCHEDULE,
    JOB_ACK,
    JOB_ARCHIVE,
    JOB_ENQUEUE,
    JOB_FAIL,
    JOB_READ,
    JOB_TOUCH,
} from "./persistence/queue.sql"
import type { QueueReadRow } from "./persistence/queue.rows"

/** A delivery in flight: the queue it belongs to, the signal that aborts it and the promise that settles when it is done. */
interface Run {
    readonly queue: string
    readonly abort: AbortController
    readonly done: Promise<void>
}

@Injectable()
/**
 * The QueueTransport port over Supabase Queues (pgmq) in the primary PostgreSQL, through the job_* functions: a send is the outbox row and
 * its message in the caller's transaction; a worker reads its queue with a visibility timeout (the per-workspace limit is enforced by
 * the read itself), renews the timeout while the handler runs, acknowledges a completed message, and on a failure makes the message
 * visible again after a backoff that doubles with each start, archiving it once the attempts are used up or the failure is unrecoverable.
 */
export class PgmqQueueTransportClient implements QueueTransport {
    private running = true
    private readonly loops: Array<Promise<void>> = []
    private readonly runs = new Set<Run>()

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes the outbox row and sends the message inside the transaction `tx`; a dedupe key that already exists sends nothing. */
    async add(tx: EntityManager, job: QueueJob): Promise<void> {
        await tx.query(JOB_ENQUEUE, [job.workspaceId, job.queue, job.job, JSON.stringify(job.payload), job.dedupeKey])
    }

    /** Creates or replaces the pg_cron job named by the scheduler id; pg_cron keeps one per name however many replicas call this. */
    async upsertScheduler(scheduler: QueueSchedulerDefinition): Promise<void> {
        await this.entityManager.query(CRON_SCHEDULE, [
            scheduler.id,
            cronScheduleOf(scheduler.everyMs),
            scheduler.queue,
            JSON.stringify(tickOf(scheduler)),
        ])
    }

    /** Starts the read loop of the handler's queue. */
    work(handler: QueueHandler, concurrency: number): Promise<void> {
        this.loops.push(this.poll(handler, concurrency))
        return Promise.resolve()
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Stops reading, gives the running deliveries the shutdown grace, aborts and hands back the ones still running, then waits for the loops. */
    async close(): Promise<void> {
        this.running = false
        await Promise.race([this.settled(), this.wait(this.options.shutdownGraceMs)])
        Array.from(this.runs).forEach((run) => run.abort.abort(new Error("worker shutting down")))
        await this.settled()
        await Promise.all(this.loops)
    }

    /** Resolves when every delivery in flight has settled. */
    private async settled(): Promise<void> {
        await Promise.all(Array.from(this.runs).map((run) => run.done))
    }

    /** One pass, then the next, until the transport closes: each pass starts from the settled promise of the last. */
    private poll(handler: QueueHandler, concurrency: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const next = (): void => {
                if (!this.running) {
                    resolve()
                    return
                }
                void this.pass(handler, concurrency).then(next, reject)
            }
            next()
        })
    }

    /** Reads at most the free slots (a pass starts only when a slot is free), starts what came back, then waits for a free slot or the poll interval. */
    private async pass(handler: QueueHandler, concurrency: number): Promise<void> {
        const free = concurrency - this.runsOf(handler.queue).length
        const messages = await this.read(handler.queue, free)
        for (const message of messages) this.start(handler, message)
        if (!this.running) return
        if (messages.length >= free) await this.slot(handler.queue)
        else await this.wait(this.options.pollIntervalMs)
    }

    /** Resolves when one of the deliveries running on the queue has settled, so a slot is free. */
    private async slot(queue: string): Promise<void> {
        await Promise.race(this.runsOf(queue).map((run) => run.done))
    }

    /** The deliveries of a queue that are running now. */
    private runsOf(queue: string): Array<Run> {
        return Array.from(this.runs).filter((run) => run.queue === queue)
    }

    /** Reads at most `quantity` messages of the queue; a failed read is logged and answers none. */
    private read(queue: string, quantity: number): Promise<Array<QueueReadRow>> {
        return this.entityManager
            .query<Array<QueueReadRow>>(JOB_READ, [
                queue,
                secondsOf(this.options.visibilityTimeoutMs),
                quantity,
                this.options.workspaceConcurrency,
            ])
            .catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.ReadFailed, cause, { queue })
                return []
            })
    }

    /** Runs one message in the background; it leaves the set of runs when it settles. */
    private start(handler: QueueHandler, message: QueueReadRow): void {
        const abort = new AbortController()
        const done = this.deliver(handler, message, abort.signal).finally(() => this.runs.delete(run))
        const run: Run = { queue: handler.queue, abort, done }
        this.runs.add(run)
    }

    /** Runs one message; a message that cannot be settled reappears after its visibility timeout. */
    private deliver(handler: QueueHandler, message: QueueReadRow, signal: AbortSignal): Promise<void> {
        return this.run(handler, message, signal).catch((cause: unknown) => {
            this.logger.error(QueueLogEvent.SettleFailed, cause, { queue: handler.queue, messageId: message.msg_id })
        })
    }

    /** Runs the handler while the visibility timeout is renewed, then acknowledges a completed message or settles the failure. */
    private async run(handler: QueueHandler, message: QueueReadRow, signal: AbortSignal): Promise<void> {
        const delivery = deliveryOf(handler.queue, message, signal)
        const heartbeat = setInterval(
            () => void this.touch(handler.queue, message),
            Math.ceil(this.options.visibilityTimeoutMs / TOUCHES_PER_TIMEOUT),
        )
        const failure = await handler.handle(delivery).then(
            () => null,
            (cause: unknown) => ({ cause }),
        )
        clearInterval(heartbeat)
        if (failure === null) await this.entityManager.query(JOB_ACK, [handler.queue, message.msg_id])
        else await this.settleFailure(handler, delivery, message, failure.cause)
    }

    /** Renews the visibility timeout of a running message; a failure is logged and the next renewal tries again. */
    private touch(queue: string, message: QueueReadRow): Promise<void> {
        return this.entityManager
            .query(JOB_TOUCH, [queue, message.msg_id, secondsOf(this.options.visibilityTimeoutMs)])
            .then(
                () => undefined,
                (cause: unknown) => {
                    this.logger.error(QueueLogEvent.TouchFailed, cause, { queue, messageId: message.msg_id })
                },
            )
    }

    /** A failed delivery goes back at once on shutdown, is archived when it cannot or may not run again, and otherwise retries after its pause. */
    private async settleFailure(
        handler: QueueHandler,
        delivery: QueueDelivery,
        message: QueueReadRow,
        cause: unknown,
    ): Promise<void> {
        const fields = { queue: handler.queue, messageId: message.msg_id, job: delivery.job, attempt: delivery.attempt }
        if (delivery.signal.aborted) {
            this.logger.warn(QueueLogEvent.HandedBack, fields)
            await this.entityManager.query(JOB_FAIL, [handler.queue, message.msg_id, 0, "worker shutting down"])
            return
        }
        if (isUnrecoverable(cause) || isExhausted(delivery.attempt)) {
            this.logger.error(QueueLogEvent.DeadLettered, cause, fields)
            await this.notifyFailed(handler, delivery, cause)
            await this.entityManager.query(JOB_ARCHIVE, [handler.queue, message.msg_id, reasonOf(cause)])
            return
        }
        this.logger.error(QueueLogEvent.DeliveryFailed, cause, fields)
        await this.entityManager.query(JOB_FAIL, [
            handler.queue,
            message.msg_id,
            retryAfterSecondsOf(cause) ?? backoffSecondsOf(delivery.attempt),
            reasonOf(cause),
        ])
    }

    /** Runs the failure hook of the handler once; a hook that throws is logged and does not keep the job from being archived. */
    private async notifyFailed(handler: QueueHandler, delivery: QueueDelivery, cause: unknown): Promise<void> {
        if (handler.failed === undefined) return
        await handler.failed(delivery, cause).catch((error: unknown) => {
            this.logger.error(QueueLogEvent.FailureHookFailed, error, { queue: handler.queue, job: delivery.job })
        })
    }
}
