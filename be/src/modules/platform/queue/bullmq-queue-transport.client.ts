import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BullmqQueueDeliveryClient } from "./bullmq-queue-delivery.client"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueHandler } from "./queue.contracts"
import { InjectQueueFactory, InjectQueueOptions } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import {
    ATTEMPTS,
    BACKOFF_MS,
    KEEP_COMPLETED_SECONDS,
    KEEP_FAILED_SECONDS,
    REDIS_DEADLINE_MS,
    backoffMsOf,
    isQueueMemoryBounded,
} from "./queue.policy"
import type {
    BullmqConnection,
    BullmqQueue,
    BullmqWorker,
    QueueFactory,
    QueueRedisGuard,
    QueueTransport,
    QueueTransportState,
} from "./queue-transport.port"

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
 * and a worker per queue hands each job to the delivery client, which runs it against the durable record — the
 * per-workspace slot limit, the start count and the reason of a failure stay in PostgreSQL, while the broker orders,
 * retries and holds the deliveries.
 */
export class BullmqQueueTransportClient implements QueueTransport {
    private readonly queues = new Map<string, BullmqQueue>()
    private readonly workers: Array<BullmqWorker> = []
    private readonly verified = new Map<string, Promise<void>>()
    private readonly guard: QueueRedisGuard = {
        ready: (queue) => this.verify(queue),
        command: (promise) => this.command(promise),
    }

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueFactory() private readonly factory: QueueFactory,
        @InjectLogger() private readonly logger: Logger,
        private readonly delivery: BullmqQueueDeliveryClient,
    ) {}

    /** Adds the job with the outbox row id as its BullMQ id, so adding it twice leaves one job. */
    async add(queue: string, job: string, jobId: string, payload: object): Promise<void> {
        await this.command(this.verify(queue))
        await this.command(
            this.queueOf(queue).add(job, payload, {
                jobId,
                attempts: ATTEMPTS,
                backoff: { type: "nivo", delay: BACKOFF_MS },
                removeOnComplete: { age: KEEP_COMPLETED_SECONDS },
                removeOnFail: { age: KEEP_FAILED_SECONDS },
            }),
        )
    }

    /** The broker-side state of the job, or "missing" when the broker holds nothing under the id. */
    async stateOf(queue: string, jobId: string): Promise<QueueTransportState> {
        const job = await this.command(this.queueOf(queue).getJob(jobId))
        if (job === undefined) return "missing"
        return TRANSPORT_STATES[await this.command(job.getState())] ?? "unknown"
    }

    /** Drops the job the broker holds and adds it again under the same id, with a fresh retry budget. */
    async republish(queue: string, job: string, jobId: string, payload: object): Promise<void> {
        const held = await this.command(this.queueOf(queue).getJob(jobId))
        if (held !== undefined) {
            const state = await this.command(held.getState())
            if (state !== "failed" && state !== "completed") return
            await this.command(held.remove())
        }
        await this.add(queue, job, jobId, payload)
    }

    /** Starts a worker of the queue whose processor settles every delivery against the durable record. */
    async work(handler: QueueHandler, concurrency: number): Promise<void> {
        await this.command(this.verify(handler.queue))
        const worker = this.factory.worker(
            handler.queue,
            (job, token) => this.delivery.deliver(handler, job, token, this.guard),
            {
                ...this.connection(false),
                concurrency,
                lockDuration: this.options.visibilityTimeoutMs,
                backoffStrategy: (attemptsMade, error) => backoffMsOf(attemptsMade, error),
            },
        )
        worker.on("error", (cause) => this.logger.error(QueueLogEvent.RedisFailed, cause, { queue: handler.queue }))
        this.workers.push(worker)
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Stops fetching, gives the deliveries in flight the shutdown grace, aborts the rest, then closes the workers and the queues. */
    async close(): Promise<void> {
        this.delivery.stop()
        await this.deadline(this.shutdown(), this.options.shutdownGraceMs + REDIS_DEADLINE_MS)
    }

    /** Pauses before draining, settles every delivery, and then closes the idle driver objects. */
    private async shutdown(): Promise<void> {
        await Promise.all(this.workers.map((worker) => worker.pause(true)))
        if (!(await this.within(this.delivery.settled(), this.options.shutdownGraceMs))) this.delivery.abortAll()
        await this.delivery.settled()
        await Promise.all(this.workers.map((worker) => worker.close()))
        await Promise.all([...this.queues.values()].map((queue) => queue.close()))
    }

    /** Waits at most the supplied duration without leaving a native timer behind. */
    private async within(promise: Promise<unknown>, ms: number): Promise<boolean> {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            return await Promise.race([
                promise.then(() => true),
                new Promise<boolean>((resolve) => {
                    timer = setTimeout(() => resolve(false), ms)
                }),
            ])
        } finally {
            clearTimeout(timer)
        }
    }

    /** A deadline refuses unsafe shutdown; it never force-closes unsettled deliveries. */
    private async deadline(promise: Promise<unknown>, ms: number): Promise<void> {
        if (await this.within(promise, ms)) return
        this.delivery.abortAll()
        const cause = new QueueError({ code: QueueErrorCode.ShutdownDeadline })
        this.logger.error(QueueLogEvent.ShutdownDeadline, cause)
        return Promise.reject(cause)
    }

    /** Bounds readiness and commands alike, including BullMQ's pre-command wait for the initial connection. */
    private command<T>(promise: Promise<T>): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined
        return Promise.race([
            promise,
            new Promise<T>((_resolve, reject) => {
                timer = setTimeout(
                    () => reject(new QueueError({ code: QueueErrorCode.RedisDeadline })),
                    REDIS_DEADLINE_MS,
                )
            }),
        ])
            .finally(() => clearTimeout(timer))
            .catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.RedisFailed, cause)
                return Promise.reject(cause)
            })
    }

    /** The Redis options every queue and worker of the app shares. */
    private connection(producer: boolean): BullmqConnection {
        return {
            prefix: this.options.prefix,
            connection: {
                host: this.options.redisHost,
                port: this.options.redisPort,
                db: this.options.redisDb,
                password: this.options.redisPassword?.reveal(),
                maxRetriesPerRequest: producer ? 1 : null,
                connectTimeout: REDIS_DEADLINE_MS,
                ...(producer ? { enableOfflineQueue: false, commandTimeout: REDIS_DEADLINE_MS } : {}),
            },
        }
    }

    /** The cached BullMQ queue of the name. */
    private queueOf(name: string): BullmqQueue {
        const known = this.queues.get(name)
        if (known !== undefined) return known
        const created = this.factory.queue(name, this.connection(true))
        created.on("error", (cause) => this.logger.error(QueueLogEvent.RedisFailed, cause, { queue: name }))
        created.on("ioredis:close", () => this.verified.delete(name))
        this.queues.set(name, created)
        return created
    }

    /** Refuses a Redis instance that may evict jobs or grow without a bound. Failed probes are retryable. */
    private verify(name: string): Promise<void> {
        const known = this.verified.get(name)
        if (known !== undefined) return known
        const checking = this.queueOf(name)
            .getBackend()
            .client.then(async (client) => {
                if (!isQueueMemoryBounded(await client.info("memory"))) {
                    return Promise.reject(new QueueError({ code: QueueErrorCode.RedisConfigurationInvalid }))
                }
                return undefined
            })
            .catch((cause: unknown) => {
                this.verified.delete(name)
                this.logger.error(QueueLogEvent.RedisFailed, cause, { queue: name })
                return Promise.reject(cause)
            })
        this.verified.set(name, checking)
        return checking
    }
}
