import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectQueueOptions, InjectQueueTransport } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { secondsOf } from "./queue.policy"
import type { QueueTransport } from "./queue-transport.port"
import { JOB_DONE, JOB_RECONCILE, JOB_RELAY_CLAIM, JOB_RELAY_SENT, JOB_RESET } from "./persistence/queue.sql"
import type { QueueReconcileRow, QueueRelayRow } from "./persistence/queue.rows"

@Injectable()
/**
 * The relay of the queue outbox: it adds each committed row that waits for Redis to BullMQ under the row id and marks
 * the rows sent in the same transaction, then reconciles nonterminal rows against the broker — a queued row the broker
 * lost or still holds as failed is republished under the same id, so no admitted job is lost. The loop runs only where
 * the consumers are enabled (a writer-only app never opens a Redis connection).
 */
export class QueueRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private running = false
    private loop: Promise<void> = Promise.resolve()

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Starts the relay loop when this app consumes queues. */
    onApplicationBootstrap(): void {
        if (!this.options.enabled) return
        this.running = true
        this.loop = this.run()
    }

    /** Stops the loop and waits for its last pass. */
    async onApplicationShutdown(): Promise<void> {
        this.running = false
        await this.loop
    }

    /** One pass: relay the waiting batch, then reconcile the stale nonterminal rows against the broker. */
    private async pass(): Promise<void> {
        const relayed = await this.relay().catch((cause: unknown) => {
            this.logger.error(QueueLogEvent.RelayFailed, cause, { outbox: "queue" })
            return 0
        })
        await this.reconcile().catch((cause: unknown) => {
            this.logger.error(QueueLogEvent.ReconcileFailed, cause)
        })
        if (relayed === 0 && this.running) await this.transport.wait(this.options.relayIntervalMs)
    }

    /** One pass, then the next, until the app stops: each pass starts from the settled promise of the last. */
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

    /** Reads and locks the oldest unsent rows, adds them to the broker and marks them sent in the same transaction. */
    private relay(): Promise<number> {
        return this.entityManager.transaction(async (tx) => {
            const rows = await tx.query<Array<QueueRelayRow>>(JOB_RELAY_CLAIM, [this.options.relayBatch])
            if (rows.length === 0) return 0
            await eachInOrder(rows, (row) => this.transport.add(row.queue, row.name, row.id, row.payload))
            await tx.query(JOB_RELAY_SENT, [rows.map((row) => row.id)])
            return rows.length
        })
    }

    /** Checks the stale nonterminal rows against the broker and repairs what the durable record and the broker disagree on. */
    private async reconcile(): Promise<void> {
        const rows = await this.entityManager.query<Array<QueueReconcileRow>>(JOB_RECONCILE, [
            secondsOf(this.options.reconcileAfterMs),
            secondsOf(2 * this.options.visibilityTimeoutMs),
            this.options.relayBatch,
        ])
        await eachInOrder(rows, (row) => this.repair(row))
    }

    /**
     * One row against the broker: a missing or still-failed job is republished under the same outbox id, a completed
     * broker job closes a row the worker could not, and a running row whose job waits again is reset to queued.
     */
    private async repair(row: QueueReconcileRow): Promise<void> {
        const state = await this.transport.stateOf(row.queue, row.id)
        switch (state) {
            case "missing":
                if (row.state === "running") await this.entityManager.query(JOB_RESET, [row.id])
                await this.transport.republish(row.queue, row.name, row.id, row.payload)
                await this.entityManager.query(JOB_RELAY_SENT, [[row.id]])
                break
            case "failed":
                if (row.state === "running") await this.entityManager.query(JOB_RESET, [row.id])
                await this.transport.republish(row.queue, row.name, row.id, row.payload)
                break
            case "completed":
                await this.entityManager.query(JOB_DONE, [row.id])
                break
            case "waiting":
            case "delayed":
                if (row.state === "running") await this.entityManager.query(JOB_RESET, [row.id])
                break
            case "active":
            case "unknown":
                break
        }
    }
}
