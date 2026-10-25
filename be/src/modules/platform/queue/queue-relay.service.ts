import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { InjectQueueOptions, InjectQueueTimeout, InjectQueueTransport } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { secondsOf } from "./queue.policy"
import type { CancelQueueTimeout, QueueTimeout } from "./queue-timeout.port"
import type { QueueTransport } from "./queue-transport.port"
import { JOB_RECONCILE, JOB_RELAY_CLAIM, JOB_RELAY_RELEASE, JOB_RELAY_SENT, JOB_RESET } from "./persistence/queue.sql"
import type { QueueReconcileRow, QueueRelayRow } from "./persistence/queue.rows"

/** A claim covers the bounded Redis lookup, removal and publication, without holding a database transaction. */
const CLAIM_SECONDS = 60
/** One relay pass has at most three bounded producer commands per row; shutdown also bounds a database failure. */
const SHUTDOWN_DEADLINE_MS = 20_000

@Injectable()
/** Publishes leased, committed outbox rows and repairs due rows fairly; no Redis operation holds PostgreSQL locks. */
export class QueueRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private running = false
    private loop: Promise<void> = Promise.resolve()

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectLogger() private readonly logger: Logger,
        @InjectQueueTimeout() private readonly timeout: QueueTimeout,
    ) {}

    /** Starts the relay loop only on an app that consumes queues. */
    onApplicationBootstrap(): void {
        if (!this.options.enabled) return
        this.running = true
        this.loop = this.run()
    }

    /** Stops admitting relay work and bounds the final pass; expired claims are recoverable by another replica. */
    async onApplicationShutdown(): Promise<void> {
        this.running = false
        let cancel: CancelQueueTimeout | undefined
        try {
            await Promise.race([
                this.loop,
                new Promise<never>((_resolve, reject) => {
                    cancel = this.timeout.schedule(
                        () => reject(new QueueError({ code: QueueErrorCode.ShutdownDeadline })),
                        SHUTDOWN_DEADLINE_MS,
                    )
                }),
            ])
        } finally {
            cancel?.()
        }
    }

    /** Each phase logs its own failure so one unavailable dependency does not discard the other phase. */
    private async pass(): Promise<void> {
        const relayed = await this.relay().catch((cause: unknown) => {
            this.logger.error(QueueLogEvent.RelayFailed, cause, { outbox: "queue" })
            return 0
        })
        if (this.running) {
            await this.reconcile().catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.ReconcileFailed, cause)
            })
        }
        if (relayed === 0 && this.running) await this.transport.wait(this.options.relayIntervalMs)
    }

    /** Serial passes, with publication within each leased batch performed concurrently. */
    private run(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const next = (): void => {
                if (!this.running) {
                    resolve()
                    return
                }
                void this.pass().then(next, reject)
            }
            next()
        })
    }

    /** Claims and commits before calling Redis; each row is marked with its own lease token afterwards. */
    private async relay(): Promise<number> {
        const rows = await this.entityManager.query<Array<QueueRelayRow>>(JOB_RELAY_CLAIM, [
            this.options.relayBatch,
            CLAIM_SECONDS,
        ])
        await Promise.all(
            rows.map((row) =>
                this.publish(row).catch((cause: unknown) => {
                    this.logger.error(QueueLogEvent.RelayFailed, cause, { queue: row.queue, jobId: row.id })
                }),
            ),
        )
        return rows.length
    }

    /** An explicit operator retry replaces a retained failed broker job under the same durable identity. */
    private async publish(row: QueueRelayRow): Promise<void> {
        if (!this.running) return
        if (row.retry_requested) await this.transport.republish(row.queue, row.name, row.id, row.payload)
        else await this.transport.add(row.queue, row.name, row.id, row.payload)
        await this.entityManager.query(JOB_RELAY_SENT, [
            row.id,
            row.lease_token,
            secondsOf(this.options.reconcileAfterMs),
        ])
    }

    /** Claims a fair due batch with SKIP LOCKED and isolates each row, including broker or settlement failures. */
    private async reconcile(): Promise<void> {
        const rows = await this.entityManager.query<Array<QueueReconcileRow>>(JOB_RECONCILE, [
            secondsOf(this.options.reconcileAfterMs),
            secondsOf(2 * this.options.visibilityTimeoutMs),
            this.options.relayBatch,
            CLAIM_SECONDS,
        ])
        await Promise.all(
            rows.map((row) =>
                this.repair(row).catch((cause: unknown) => {
                    this.logger.error(QueueLogEvent.ReconcileFailed, cause, { queue: row.queue, jobId: row.id })
                }),
            ),
        )
    }

    /** A broker completion alone cannot prove handler completion; any nonterminal orphan must run the fenced handler. */
    private async repair(row: QueueReconcileRow): Promise<void> {
        if (!this.running) return
        const state = await this.transport.stateOf(row.queue, row.id)
        if (!this.running) return
        if (state === "missing" || state === "failed" || state === "completed") {
            const [reset] = await this.entityManager.query<Array<{ reset: boolean }>>(JOB_RESET, [
                row.id,
                row.lease_token,
                row.run_token,
            ])
            if (reset?.reset === true) await this.transport.republish(row.queue, row.name, row.id, row.payload)
        }
        await this.entityManager.query(JOB_RELAY_RELEASE, [row.id, row.lease_token])
    }
}
