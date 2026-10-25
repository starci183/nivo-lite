import type { QueueHandler } from "./queue.contracts"

/** The Redis-side state of a job, as the relay reconciles it; "missing" means the broker holds nothing under the id. */
export type QueueTransportState = "waiting" | "delayed" | "active" | "completed" | "failed" | "missing" | "unknown"

/** BullMQ on Redis as the queue capability sees it: the one port the BullMQ client implements. */
export interface QueueTransport {
    /**
     * Adds the job to its queue under the outbox row id `jobId`; an id BullMQ already holds makes the add a no-op, so a
     * repeated relay pass is harmless. The retry budget and backoff of the platform are fixed here.
     */
    add(queue: string, job: string, jobId: string, payload: object): Promise<void>
    /** The Redis-side state of the job `jobId`. */
    stateOf(queue: string, jobId: string): Promise<QueueTransportState>
    /**
     * Drops the job the broker holds under `jobId` and adds it again: a fresh retry budget under the same outbox id
     * (an operator requeue, or a failed/lost job the relay republishes so no admitted job is lost).
     */
    republish(queue: string, job: string, jobId: string, payload: object): Promise<void>
    /** Starts a worker of the queue the handler names that runs it for every job, `concurrency` at a time. */
    work(handler: QueueHandler, concurrency: number): Promise<void>
    /** Resolves after `ms` milliseconds: the only clock of the relay loop. */
    wait(ms: number): Promise<void>
    /** Signals the running deliveries, gives them the shutdown grace, then closes the workers and the queues. */
    close(): Promise<void>
}

/** The Redis a driver object connects to. */
export interface BullmqRedis {
    /** The host. */
    readonly host: string
    /** The port. */
    readonly port: number
    /** The Redis database that holds this app's queue state. */
    readonly db: number
    /** The password of the queue credential, when the deployment sets one. */
    readonly password?: string | undefined
    /** BullMQ answers to commands only through a client that does not retry on its own. */
    readonly maxRetriesPerRequest: number | null
}

/** The Redis options every queue and worker of the app shares. */
export interface BullmqConnection {
    /** The key prefix of the app. */
    readonly prefix: string
    /** The Redis the driver connects to. */
    readonly connection: BullmqRedis
}

/** The wait between two tries of a job. */
export interface BullmqBackoff {
    /** The backoff shape. */
    readonly type: string
    /** The first wait, in milliseconds. */
    readonly delay: number
}

/** How long a finished job is kept. */
export interface BullmqRetention {
    /** The seconds a finished job is kept. */
    readonly age: number
}

/** The options the transport fixes on every job it adds. */
export interface BullmqJobOptions {
    /** The id BullMQ dedupes on: the outbox row id. */
    readonly jobId: string
    /** How many times BullMQ tries the job. */
    readonly attempts: number
    /** The wait between two tries. */
    readonly backoff: BullmqBackoff
    /** How long a finished job is kept. */
    readonly removeOnComplete: BullmqRetention
}

/** The options a worker is built with: the shared connection, its concurrency and its failure policy. */
export interface BullmqWorkerOptions extends BullmqConnection {
    /** How many jobs the worker runs at a time. */
    readonly concurrency: number
    /** How long BullMQ holds the lock of a running job before another worker may recover it. */
    readonly lockDuration: number
    /** The delay of the next try after a failure: a retry hint of the failing error wins over the default backoff. */
    readonly backoffStrategy: (attemptsMade: number, error?: Error) => number
}

/** A job as the transport uses it: the worker's delivery plus the reconciliation handles. */
export interface BullmqJob {
    /** The job id: the outbox row id of every job the relay published. */
    readonly id?: string | undefined
    /** The job name inside the queue. */
    readonly name: string
    /** The payload the producer wrote. */
    readonly data: object
    /** How many deliveries were started before this one. */
    readonly attemptsMade: number
    /** Postpones the job to `timestamp` without spending a try (the workspace deferral and the shutdown hand-back). */
    moveToDelayed(timestamp: number, token?: string): Promise<void>
    /** The Redis-side state of the job. */
    getState(): Promise<string>
    /** Drops the job so a republish of the same id is a fresh job. */
    remove(): Promise<void>
}

/** What a queue answers for an id: the job it holds, or nothing. */
export type BullmqJobLookup = BullmqJob | undefined

/** The processor a worker runs for every job of its queue; `token` is the job token `moveToDelayed` needs. */
export type BullmqProcessor = (job: BullmqJob, token?: string) => Promise<void>

/** A queue as the transport uses it. */
export interface BullmqQueue {
    /** Adds the job; an id BullMQ already holds makes the add a no-op. */
    add(name: string, payload: object, options: BullmqJobOptions): Promise<unknown>
    /** The job held under `id`, or nothing. */
    getJob(id: string): Promise<BullmqJobLookup>
    /** Closes the queue. */
    close(): Promise<void>
}

/** A worker as the transport uses it. */
export interface BullmqWorker {
    /** Stops the worker; `force` drops the jobs it is still running. */
    close(force: boolean): Promise<void>
}

/** Builds the BullMQ objects; the module provides it so a spec can double it through the injection token. */
export interface QueueFactory {
    /** The queue of the name over the shared connection. */
    queue(name: string, options: BullmqConnection): BullmqQueue
    /** A worker that runs the processor for every job of the queue. */
    worker(name: string, processor: BullmqProcessor, options: BullmqWorkerOptions): BullmqWorker
}
